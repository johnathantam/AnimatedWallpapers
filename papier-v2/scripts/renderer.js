const FS = require('fs');
const PATH = require('path');
const ENGINE = require('bindings')('engine');

class App {
    constructor() {
        this.initializeApp();
    }

    async initializeApp() {
        // Initialize the backend
        ENGINE.initialize();
        new DirectoryCreatorCommand().execute();

        // Initialize the frontend
        this.settings = new Settings();

        this.wallpaperList = new WallpaperList();
        this.wallpaperConfigurator = new WallpaperConfigurator();
        
        this.wallpaperLoader = new WallpaperLoader(this.wallpaperList, this.wallpaperConfigurator, this.settings);
        this.wallpaperPanel = new WallpaperPanel(this.wallpaperList, this.wallpaperLoader, this.wallpaperConfigurator);
        this.addWallpaperWidget = new AddWallpaperWidget(this.wallpaperLoader, this.wallpaperPanel);
        this.appToggle = new PauseOrPlayToggle();
        this.appNavigator = new AppNavigator();
    }
}


new App();