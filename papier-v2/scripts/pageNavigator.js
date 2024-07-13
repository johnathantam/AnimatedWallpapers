class AppNavigator {
    constructor () {
        this.mainApplicationSection = document.getElementById("main-application-section");
        this.mainApplicationWallpaperEditor = document.getElementById("wallpaper-editor-section");
        this.mainApplicationLink = document.getElementById("navigate-to-main-application-button")
        
        this.settingSection = document.getElementById("settings-section");
        this.settingsSideBar = document.getElementById("settings-info-section");
        this.settingsLink = document.getElementById("navigate-to-settings-button");

        this.addNavigationFunctionality();
    }

    navigateToMainApplication() {
        this.settingSection.style.display= "none";
        this.settingsSideBar.style.display = "none";
        this.mainApplicationSection.style.display = "flex";
        this.mainApplicationWallpaperEditor.style.display = "block";
    }

    navigateToSettings() {
        this.mainApplicationSection.style.display = "none";
        this.mainApplicationWallpaperEditor.style.display = "none";
        this.settingSection.style.display = "block";
        this.settingsSideBar.style.display = "block";
    }

    addNavigationFunctionality() {
        this.mainApplicationLink.addEventListener("click", () => { this.navigateToMainApplication() });
        this.settingsLink.addEventListener("click", () => { this.navigateToSettings() });
    }
}