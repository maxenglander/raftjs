  // Nodejs dependencies
var fs           = require('fs'),
  os             = require('os'),
  path           = require('path'),

  // Vendor dependencies
  del            = require('del'),
  dependencyTree = require('dependency-tree'),
  docco          = require('docco'),
  flatc          = require('flatc'),
  minimist       = require('minimist'),
  through        = require('through2'),

  // Gulp and gulp plugins
  gulp           = require('gulp'),
  gulpBabel      = require('gulp-babel'),
  gulpConcat     = require('gulp-concat'),
  gulpEslint     = require('gulp-eslint7'),
  gulpFilter     = require('gulp-filter')
  gulpIf         = require('gulp-if'),
  gulpMocha      = require('gulp-mocha'),
  gulpPrettier   = require('gulp-prettier'),
  gulpRead       = require('gulp-read'),
  gulpReplace    = require('gulp-replace'),
  gulpSourcemaps = require('gulp-sourcemaps'),
  gulpTs         = require('gulp-typescript'),

  // Local config
  babelRc        = JSON.parse(fs.readFileSync(path.join(__dirname, '.babelrc')))
  pkgJson        = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'))),
  prettierRc     = JSON.parse(fs.readFileSync(path.join(__dirname, '.prettierrc'))),
  tsConfig       = path.join(__dirname, 'tsconfig.json'),
  tsConfigTest   = path.join(__dirname, 'tsconfig-test.json'),

  // Constants
  Exts           = {
    FBS:     'fbs',
    JS:      'js',
    MAP:     'map',
    TEST_JS: 'test.js',
    TS:      'ts'
  },
  Dirs           = {
    Build: {
      BASE: path.join(__dirname, pkgJson.directories.build.base),
      DIST: path.join(__dirname, pkgJson.directories.build.dist),
      GEN:  path.join(__dirname, pkgJson.directories.build.gen),
      TEST: path.join(__dirname, pkgJson.directories.build.test),
    },
    DIST: path.join(__dirname, pkgJson.directories.dist),
    DOCS: path.join(__dirname, pkgJson.directories.docs),
    SRC:  path.join(__dirname, pkgJson.directories.src),
    TEST: path.join(__dirname, pkgJson.directories.test)
  };

const gulpStreams = {
  annotateSource(options) {
    return through.obj(function(input, encoding, callback) {
      docco.document({
        args: [input.relative],
        output: options.output 
      }, callback);
    });
  },
  compileFlatbuffers(options) {
    return through.obj(function(input, encoding, callback) {
      const outputDir = path.join(options.outputDir, path.dirname(input.relative));

      flatc(input.path, {
        language: [options.language],
        outputDir
      })
      .then(function() {
        const output = input.clone();
        output.path = path.join(outputDir, input.stem + '_generated.ts');
        callback(null, output);
      })
      .catch(callback);
    });
  },
  compileTypeScript(options) {
    const tsProject = gulpTs.createProject(options.tsConfig);
    return tsProject();
  },
  lint() {
    return gulpEslint({
      fix: true,
      parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module'
      },
      rules: {
        'indent': ['error', 2, {
          'SwitchCase': 1,
          'VariableDeclarator': 'first'
        }],
        'lines-between-class-members': ['error', 'always'],
        'padding-line-between-statements': [
          'error', 
          { blankLine: 'always', prev: '*', next: 'block-like' },
          { blankLine: 'always', prev: 'block-like', next: '*' },
          { blankLine: 'always', prev: '*', next: 'class' },
          { blankLine: 'always', prev: 'class', next: '*' },
          { blankLine: 'always', prev: '*', next: 'const' },
          { blankLine: 'always', prev: 'const', next: '*' },
          { blankLine: 'always', prev: '*', next: 'export' },
          { blankLine: 'always', prev: 'export', next: '*' },
          { blankLine: 'always', prev: '*', next: 'multiline-block-like' },
          { blankLine: 'always', prev: 'multiline-block-like', next: '*' }
        ],
        'one-var-declaration-per-line': ['error', 'initializations']
      }
    }).pipe(gulpEslint.format());
  },
  removeEmptyFiles() {
    return through.obj(function(input, encoding, callback) {
      if(input.contents.toString(encoding).trim().length > 0) {
        this.push(input);
      }
      callback();
    });
  }
}

const helpers = {
  dirsToGlobs(dirs, exts) {
    const result = [];

    for(let dir of dirs) {
      if(exts && exts.length > 0) {
        for(let ext of exts) {
          result.push(path.join(dir, '**', '*.' + ext));
        }
      } else {
        result.push(path.join(dir, '**', '*'));
      }
    }

    return result;
  },
  toAbsolutePath(file) {
    let absolutePath;

    if(path.isAbsolute(file)) {
      absolutePath = file;
    } else {
      absolutePath = path.resolve(file);
    }

    return absolutePath;
  }
};

gulp.task('clean:build', function() {
  return del([]
    .concat(helpers.dirsToGlobs([Dirs.Build.BASE]))
  );
});

gulp.task('clean', gulp.parallel('clean:build'));

gulp.task('compile:flatbuffers', function() {
  return gulp.src(helpers.dirsToGlobs([ Dirs.SRC ], [ Exts.FBS ]), { read: false })
    .pipe(gulpStreams.compileFlatbuffers({
      language: Exts.TS,
      outputDir: Dirs.Build.GEN
    }))
    .pipe(gulpRead())
    .pipe(gulpReplace('./flatbuffers', 'flatbuffers'))
    .pipe(gulp.dest(Dirs.Build.BASE));
});

gulp.task('compile:typescript', function() {
  return gulp.src(helpers.dirsToGlobs([ Dirs.Build.GEN, Dirs.SRC ], [ Exts.JS, Exts.TS ]))
    .pipe(gulpSourcemaps.init())
    .pipe(gulpStreams.compileTypeScript({ tsConfig }))
    .pipe(gulpBabel(babelRc))
    .pipe(gulpSourcemaps.write({
      sourceRoot: Dirs.SRC
    }))
    .pipe(gulp.dest(Dirs.Build.DIST));
});

gulp.task('compile', gulp.series('compile:flatbuffers', 'compile:typescript'));

gulp.task('dist:copy-build', function() {
  return gulp.src(helpers.dirsToGlobs([ Dirs.Build.DIST ], [ Exts.JS ]))
    .pipe(gulp.dest(Dirs.DIST));
});

gulp.task('dist', gulp.series('compile', 'dist:copy-build'));

gulp.task('docs:annotate-source', gulp.series('compile:flatbuffers', function() {
  const files = dependencyTree.toList({
    directory: Dirs.SRC,
    filename: path.join(Dirs.SRC, 'annotated-source.ts'),
    filter: path => path.indexOf('node_modules') === -1,
    tsConfig
  }).reverse().filter(function(file) {
    return file.match('@types.ts') === null;
  });

  return gulp.src(files, { base: Dirs.SRC })
    .pipe(gulpReplace(/ +\/\/ eslint-disable-line.*$/gm, ''))
    .pipe(gulpStreams.compileTypeScript({ tsConfig }))
    .pipe(gulpStreams.lint())
    .pipe(gulpPrettier(prettierRc))
    .pipe(gulpReplace('export {};', ''))
    .pipe(gulpStreams.removeEmptyFiles())
    .pipe(through.obj(function addFilenameAsComment(input, encoding, callback) {
      const clone = input.clone();
      clone.contents = Buffer.concat([
        input.basename != 'annotated-source.js'
          ? Buffer.from("\n// __" + input.relative + "__  \n// ___\n/** " + input.relative + "*/\n")
          : Buffer.alloc(0),
        input.contents,
      ]);
      callback(null, clone);
    }))
    .pipe(gulpConcat('annotated-source.js'))
    .pipe(gulp.dest(__dirname))
    .pipe(gulpStreams.annotateSource({
      output: Dirs.DOCS
    }));
}));

gulp.task('docs', gulp.series('docs:annotate-source'));

gulp.task('lint:check:eslint', function() {
  return gulp.src(helpers.dirsToGlobs([Dirs.SRC, Dirs.TEST], [Exts.TS]))
    .pipe(gulpEslint())
    .pipe(gulpEslint.format())
    .pipe(gulpEslint.failAfterError());
});

gulp.task('lint:check:prettier', function() {
  return gulp.src(helpers.dirsToGlobs([Dirs.SRC, Dirs.TEST], [Exts.TS]))
    .pipe(gulpPrettier.check(prettierRc));
});

gulp.task('lint:check', gulp.series('lint:check:eslint', 'lint:check:prettier'));

gulp.task('lint:fix:prettier', function() {
  return gulp.src(helpers.dirsToGlobs([Dirs.SRC, Dirs.TEST], [Exts.TS]))
    .pipe(gulpPrettier(prettierRc))
    .pipe(gulp.dest(function(file) {
      return file.base;
    }));
});

gulp.task('lint:fix', gulp.series('lint:fix:prettier'));

gulp.task('test:compile:typescript', function() {
  const options = minimist(process.argv.slice(2), {}),
    pattern = options.file
      ? helpers.toAbsolutePath(options.file)
      : helpers.dirsToGlobs([ Dirs.TEST ], [ Exts.JS, Exts.TS ]);

  return gulp.src(pattern, { base: Dirs.TEST })
    .pipe(gulpSourcemaps.init())
    .pipe(gulpStreams.compileTypeScript({ tsConfig: tsConfigTest }))
    .pipe(gulpBabel(babelRc))
    .pipe(gulpSourcemaps.write({
      sourceRoot: Dirs.TEST
    }))
    .pipe(gulp.dest(Dirs.Build.TEST));
});

gulp.task('test:compile', gulp.series('test:compile:typescript'));

gulp.task('test:merge-sources', function() {
  return gulp.src(helpers.dirsToGlobs([ Dirs.Build.DIST ]))
    .pipe(through.obj(function(file, encoding, callback) {
      const testFile = path.join(Dirs.TEST, file.relative);

      if(  fs.existsSync(testFile)
        && fs.statSync(testFile).isFile()) {
        callback(new Error('Cannot merge sources and test sources due to file name conflict: ' + dest));
      } else {
        callback(null, file);
      }
    }))
    .pipe(gulp.dest(Dirs.Build.TEST));
});

gulp.task('test:run', function() {
  var options = minimist(process.argv.slice(2), {}),
    pattern = options.file
      ? helpers.toAbsolutePath(options.file)
          .replace(Dirs.TEST, Dirs.Build.TEST)
          .split('.').slice(0, -1).join('.').concat('.', Exts.JS)
      : helpers.dirsToGlobs([ Dirs.Build.TEST ], [ Exts.TEST_JS ]);

  return gulp.src(pattern, { read: false })
    .pipe(gulpMocha({
      require: [ '@babel/register' ]
    }))
});

gulp.task('test', gulp.series('compile', 'test:compile', 'test:merge-sources', 'test:run'));
