module.exports = function override(config) {
    // allows react-app-rewired to build a development version that is more debuggable in browser
    config.mode = 'development';
    config.optimization.minimize = false;
    return config;
};