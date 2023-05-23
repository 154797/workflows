"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.collectProjectsAndTestFiles = collectProjectsAndTestFiles;
exports.createRootSuite = createRootSuite;
exports.loadFileSuites = loadFileSuites;
exports.loadGlobalHook = loadGlobalHook;
exports.loadReporter = loadReporter;
var _path = _interopRequireDefault(require("path"));
var _loaderHost = require("./loaderHost");
var _test = require("../common/test");
var _util = require("../util");
var _projectUtils = require("./projectUtils");
var _transform = require("../common/transform");
var _suiteUtils = require("../common/suiteUtils");
var _testGroups = require("./testGroups");
var _compilationCache = require("../common/compilationCache");
var _utilsBundle = require("../utilsBundle");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

async function collectProjectsAndTestFiles(testRun, additionalFileMatcher) {
  const config = testRun.config;
  const fsCache = new Map();
  const sourceMapCache = new Map();
  const cliFileMatcher = config.cliArgs.length ? (0, _util.createFileMatcherFromArguments)(config.cliArgs) : null;

  // First collect all files for the projects in the command line, don't apply any file filters.
  const allFilesForProject = new Map();
  for (const project of (0, _projectUtils.filterProjects)(config.projects, config.cliProjectFilter)) {
    const files = await (0, _projectUtils.collectFilesForProject)(project, fsCache);
    allFilesForProject.set(project, files);
  }

  // Filter files based on the file filters, eliminate the empty projects.
  const filesToRunByProject = new Map();
  for (const [project, files] of allFilesForProject) {
    const matchedFiles = files.filter(file => {
      const hasMatchingSources = sourceMapSources(file, sourceMapCache).some(source => {
        if (additionalFileMatcher && !additionalFileMatcher(source)) return false;
        if (cliFileMatcher && !cliFileMatcher(source)) return false;
        return true;
      });
      return hasMatchingSources;
    });
    const filteredFiles = matchedFiles.filter(Boolean);
    if (filteredFiles.length) filesToRunByProject.set(project, filteredFiles);
  }

  // (Re-)add all files for dependent projects, disregard filters.
  const projectClosure = (0, _projectUtils.buildProjectsClosure)([...filesToRunByProject.keys()]);
  for (const [project, type] of projectClosure) {
    if (type === 'dependency') {
      filesToRunByProject.delete(project);
      const files = allFilesForProject.get(project) || (await (0, _projectUtils.collectFilesForProject)(project, fsCache));
      filesToRunByProject.set(project, files);
    }
  }
  testRun.projects = [...filesToRunByProject.keys()];
  testRun.projectFiles = filesToRunByProject;
  testRun.projectType = projectClosure;
  testRun.projectSuites = new Map();
}
async function loadFileSuites(testRun, mode, errors) {
  // Determine all files to load.
  const config = testRun.config;
  const allTestFiles = new Set();
  for (const files of testRun.projectFiles.values()) files.forEach(file => allTestFiles.add(file));

  // Load test files.
  const fileSuiteByFile = new Map();
  const loaderHost = mode === 'out-of-process' ? new _loaderHost.OutOfProcessLoaderHost(config) : new _loaderHost.InProcessLoaderHost(config);
  for (const file of allTestFiles) {
    const fileSuite = await loaderHost.loadTestFile(file, errors);
    fileSuiteByFile.set(file, fileSuite);
    errors.push(...createDuplicateTitlesErrors(config, fileSuite));
  }
  await loaderHost.stop();

  // Check that no test file imports another test file.
  // Loader must be stopped first, since it popuplates the dependency tree.
  for (const file of allTestFiles) {
    for (const dependency of (0, _compilationCache.dependenciesForTestFile)(file)) {
      if (allTestFiles.has(dependency)) {
        const importer = _path.default.relative(config.config.rootDir, file);
        const importee = _path.default.relative(config.config.rootDir, dependency);
        errors.push({
          message: `Error: test file "${importer}" should not import test file "${importee}"`,
          location: {
            file,
            line: 1,
            column: 1
          }
        });
      }
    }
  }

  // Collect file suites for each project.
  for (const [project, files] of testRun.projectFiles) {
    const suites = files.map(file => fileSuiteByFile.get(file)).filter(Boolean);
    testRun.projectSuites.set(project, suites);
  }
}
async function createRootSuite(testRun, errors, shouldFilterOnly) {
  const config = testRun.config;
  // Create root suite, where each child will be a project suite with cloned file suites inside it.
  const rootSuite = new _test.Suite('', 'root');

  // First add top-level projects, so that we can filterOnly and shard just top-level.
  {
    // Interpret cli parameters.
    const cliFileFilters = (0, _util.createFileFiltersFromArguments)(config.cliArgs);
    const grepMatcher = config.cliGrep ? (0, _util.createTitleMatcher)((0, _util.forceRegExp)(config.cliGrep)) : () => true;
    const grepInvertMatcher = config.cliGrepInvert ? (0, _util.createTitleMatcher)((0, _util.forceRegExp)(config.cliGrepInvert)) : () => false;
    const cliTitleMatcher = title => !grepInvertMatcher(title) && grepMatcher(title);

    // Clone file suites for top-level projects.
    for (const [project, fileSuites] of testRun.projectSuites) {
      if (testRun.projectType.get(project) === 'top-level') rootSuite._addSuite(await createProjectSuite(fileSuites, project, {
        cliFileFilters,
        cliTitleMatcher,
        testIdMatcher: config.testIdMatcher
      }));
    }
  }

  // Complain about only.
  if (config.config.forbidOnly) {
    const onlyTestsAndSuites = rootSuite._getOnlyItems();
    if (onlyTestsAndSuites.length > 0) errors.push(...createForbidOnlyErrors(onlyTestsAndSuites));
  }

  // Filter only for top-level projects.
  if (shouldFilterOnly) (0, _suiteUtils.filterOnly)(rootSuite);

  // Shard only the top-level projects.
  if (config.config.shard) {
    // Create test groups for top-level projects.
    const testGroups = [];
    for (const projectSuite of rootSuite.suites) testGroups.push(...(0, _testGroups.createTestGroups)(projectSuite, config.config.workers));

    // Shard test groups.
    const testGroupsInThisShard = (0, _testGroups.filterForShard)(config.config.shard, testGroups);
    const testsInThisShard = new Set();
    for (const group of testGroupsInThisShard) {
      for (const test of group.tests) testsInThisShard.add(test);
    }

    // Update project suites, removing empty ones.
    (0, _suiteUtils.filterTestsRemoveEmptySuites)(rootSuite, test => testsInThisShard.has(test));
  }

  // Now prepend dependency projects.
  {
    // Filtering only and sharding might have reduced the number of top-level projects.
    // Build the project closure to only include dependencies that are still needed.
    const projectClosure = new Map((0, _projectUtils.buildProjectsClosure)(rootSuite.suites.map(suite => suite._fullProject)));

    // Clone file suites for dependency projects.
    for (const [project, fileSuites] of testRun.projectSuites) {
      if (testRun.projectType.get(project) === 'dependency' && projectClosure.has(project)) rootSuite._prependSuite(await createProjectSuite(fileSuites, project, {
        cliFileFilters: [],
        cliTitleMatcher: undefined
      }));
    }
  }
  return rootSuite;
}
async function createProjectSuite(fileSuites, project, options) {
  const projectSuite = new _test.Suite(project.project.name, 'project');
  projectSuite._fullProject = project;
  if (project.fullyParallel) projectSuite._parallelMode = 'parallel';
  for (const fileSuite of fileSuites) {
    for (let repeatEachIndex = 0; repeatEachIndex < project.project.repeatEach; repeatEachIndex++) {
      const builtSuite = (0, _suiteUtils.buildFileSuiteForProject)(project, fileSuite, repeatEachIndex);
      projectSuite._addSuite(builtSuite);
    }
  }
  (0, _suiteUtils.filterByFocusedLine)(projectSuite, options.cliFileFilters);
  (0, _suiteUtils.filterByTestIds)(projectSuite, options.testIdMatcher);
  const grepMatcher = (0, _util.createTitleMatcher)(project.project.grep);
  const grepInvertMatcher = project.project.grepInvert ? (0, _util.createTitleMatcher)(project.project.grepInvert) : null;
  const titleMatcher = test => {
    const grepTitle = test.titlePath().join(' ');
    if (grepInvertMatcher !== null && grepInvertMatcher !== void 0 && grepInvertMatcher(grepTitle)) return false;
    return grepMatcher(grepTitle) && (!options.cliTitleMatcher || options.cliTitleMatcher(grepTitle));
  };
  (0, _suiteUtils.filterTestsRemoveEmptySuites)(projectSuite, titleMatcher);
  return projectSuite;
}
function createForbidOnlyErrors(onlyTestsAndSuites) {
  const errors = [];
  for (const testOrSuite of onlyTestsAndSuites) {
    // Skip root and file.
    const title = testOrSuite.titlePath().slice(2).join(' ');
    const error = {
      message: `Error: focused item found in the --forbid-only mode: "${title}"`,
      location: testOrSuite.location
    };
    errors.push(error);
  }
  return errors;
}
function createDuplicateTitlesErrors(config, fileSuite) {
  const errors = [];
  const testsByFullTitle = new Map();
  for (const test of fileSuite.allTests()) {
    const fullTitle = test.titlePath().slice(1).join(' › ');
    const existingTest = testsByFullTitle.get(fullTitle);
    if (existingTest) {
      const error = {
        message: `Error: duplicate test title "${fullTitle}", first declared in ${buildItemLocation(config.config.rootDir, existingTest)}`,
        location: test.location
      };
      errors.push(error);
    }
    testsByFullTitle.set(fullTitle, test);
  }
  return errors;
}
function buildItemLocation(rootDir, testOrSuite) {
  if (!testOrSuite.location) return '';
  return `${_path.default.relative(rootDir, testOrSuite.location.file)}:${testOrSuite.location.line}`;
}
async function requireOrImportDefaultFunction(file, expectConstructor) {
  let func = await (0, _transform.requireOrImport)(file);
  if (func && typeof func === 'object' && 'default' in func) func = func['default'];
  if (typeof func !== 'function') throw (0, _util.errorWithFile)(file, `file must export a single ${expectConstructor ? 'class' : 'function'}.`);
  return func;
}
function loadGlobalHook(config, file) {
  return requireOrImportDefaultFunction(_path.default.resolve(config.config.rootDir, file), false);
}
function loadReporter(config, file) {
  return requireOrImportDefaultFunction(_path.default.resolve(config.config.rootDir, file), true);
}
function sourceMapSources(file, cache) {
  let sources = [file];
  if (!file.endsWith('.js')) return sources;
  if (cache.has(file)) return cache.get(file);
  try {
    const sourceMap = _utilsBundle.sourceMapSupport.retrieveSourceMap(file);
    const sourceMapData = typeof (sourceMap === null || sourceMap === void 0 ? void 0 : sourceMap.map) === 'string' ? JSON.parse(sourceMap.map) : sourceMap === null || sourceMap === void 0 ? void 0 : sourceMap.map;
    if (sourceMapData !== null && sourceMapData !== void 0 && sourceMapData.sources) sources = sourceMapData.sources.map(source => _path.default.resolve(_path.default.dirname(file), source));
  } finally {
    cache.set(file, sources);
    return sources;
  }
}