var plugins = require("gulp-load-plugins");
var yargs = require("yargs");
var browser = require("browser-sync");
var gulp = require("gulp");
var panini = require("panini");
var concat = require("gulp-concat");
var rimraf = require("rimraf");
var yaml = require("js-yaml");
var fs = require("fs");
var autoprefixer = require("autoprefixer");

// Load all Gulp plugins into one variable
const $ = plugins();

// Check for --production flag
const PRODUCTION = !!yargs.argv.production;

// Load settings from settings.yml
const { PORT, PATHS } = loadConfig();

function loadConfig() {
  let ymlFile = fs.readFileSync("config.yml", "utf8");
  return yaml.load(ymlFile);
}

// Build the "dist" folder by running all of the below tasks
// Sass must be run later so UnCSS can search for used classes in the others assets.
gulp.task("build", gulp.series(clean, gulp.parallel(pages, images, copy), sass));

// Build the site, run the server, and watch for file changes
gulp.task("default", gulp.series("build", server, watch));

// Delete the "dist" folder
// This happens every time a build starts
function clean(done) {
  rimraf(PATHS.dist, done);
}

// Copy files out of the assets folder
// This task skips over the "img", "js", and "scss" folders, which are parsed separately
function copy() {
  return gulp.src(PATHS.assets).pipe(gulp.dest(PATHS.dist + "/assets"));
}

// Copy page templates into finished HTML files
function pages() {
  return gulp
    .src("src/pages/**/*.{html,hbs,handlebars}")
    .pipe(
      panini({
        root: "src/pages/",
        layouts: "src/layouts/",
        partials: "src/partials/",
        data: "src/data/",
        helpers: "src/helpers/",
      })
    )
    .pipe(gulp.dest(PATHS.dist));
}

// Load updated HTML templates and partials into Panini
function resetPages(done) {
  panini.refresh();
  done();
}

// Compile Sass into CSS
// In production, the CSS is compressed
function sass() {
  const tailwindcss = require("tailwindcss");
  const postCssPlugins = [
    tailwindcss("./tailwind.config.js"),
    // Autoprefixer
    autoprefixer(),

    // UnCSS - Uncomment to remove unused styles in production
    // PRODUCTION && uncss.postcssPlugin(UNCSS_OPTIONS),
  ].filter(Boolean);

  return gulp
    .src("src/assets/theme/app.scss")
    .pipe($.sourcemaps.init())
    .pipe(
      $.sass({
        includePaths: PATHS.sass,
      }).on("error", $.sass.logError)
    )
    .pipe($.postcss(postCssPlugins))
    .pipe($.if(PRODUCTION, $.cleanCss({ compatibility: "ie9" })))
    .pipe($.if(!PRODUCTION, $.sourcemaps.write()))
    .pipe(concat({ path: "app.css" }))
    .pipe(gulp.dest(PATHS.dist + "/assets/theme"))
    .pipe(browser.reload({ stream: true }));
}

// Copy images to the "dist" folder
// In production, the images are compressed
function images() {
  return gulp
    .src("src/assets/img/**/*")
    .pipe($.if(PRODUCTION, $.imagemin([$.imagemin.mozjpeg({ progressive: true })])))
    .pipe(gulp.dest(PATHS.dist + "/assets/img"));
}

// Start a server with BrowserSync to preview the site in
function server(done) {
  browser.init(
    {
      server: PATHS.dist,
      port: PORT,
    },
    done
  );
}

// Watch for changes to static assets, pages, Sass, and JavaScript
function watch() {
  gulp.watch(PATHS.assets, copy);
  gulp.watch("src/pages/**/*.html").on("all", gulp.series(pages, browser.reload));
  gulp
    .watch("src/{layouts,partials}/**/*.html")
    .on("all", gulp.series(resetPages, pages, browser.reload));
  gulp
    .watch("src/data/**/*.{js,json,yml}")
    .on("all", gulp.series(resetPages, pages, browser.reload));
  gulp.watch("src/helpers/**/*.js").on("all", gulp.series(resetPages, pages, browser.reload));
  gulp.watch("src/assets/theme/**/*.scss").on("all", sass);
  gulp.watch("src/assets/img/**/*").on("all", gulp.series(images, browser.reload));
}
