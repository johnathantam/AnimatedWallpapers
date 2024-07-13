class Settings {
    constructor() {
        this.saveSettingsButton = document.getElementById("save-settings-button");
        this.frameRateInput = document.getElementById("set-framerate-setting-input")
        this.pauseWhenOtherApplicationsAreFocusedDropdown = new DropDown("keep-running-when-focused-dropdown-text", ["keep-running-when-other-applications-are-focused-choice", "stop-running-when-other-applications-are-focused-choice"]);
        this.pauseWhenOtherApplicationsAreMaximizedDropdown = new DropDown("keep-running-when-maximized-dropdown-text", ["keep-running-when-other-applications-are-maximized-choice", "stop-running-when-other-applications-are-maximized-choice"]);

        this.pauseWhenOtherApplicationsAreFocused = true;
        this.pauseWhenOtherApplicationsAreMaximized = true;
        this.frameRate = 16;
        this.settingsPath = PATH.join(__dirname, "saved_data", "settings_config", "settings.json");

        this.initialize();
        this.addSaveFunctionality();
    }

    initialize() {
        // Fetch the saved settings
        FS.readFile(this.settingsPath, 'utf8', (err, data) => {
            try {
                const settings = JSON.parse(data);

                // Update instance variables with fetched settings
                this.frameRate = settings.frameRate;
                this.pauseWhenOtherApplicationsAreFocused = settings.pauseWhenOtherApplicationsAreFocused;
                this.pauseWhenOtherApplicationsAreMaximized = settings.pauseWhenOtherApplicationsAreMaximized;

                this.frameRateInput.value = this.frameRate;
                this.pauseWhenOtherApplicationsAreFocusedDropdown.setCurrentValue(this.pauseWhenOtherApplicationsAreFocused ? "Stop Running" : "Keep Running");
                this.pauseWhenOtherApplicationsAreMaximizedDropdown.setCurrentValue(this.pauseWhenOtherApplicationsAreMaximized ? "Stop Running" : "Keep Running");

                ENGINE.setSettings(this.pauseWhenOtherApplicationsAreFocused, this.pauseWhenOtherApplicationsAreMaximized, this.frameRate);
            } 
            catch (error) {
                return;
            }
        })
    }

    saveSettings() {
        // Save the settings
        const settings = {
            frameRate: this.frameRate,
            pauseWhenOtherApplicationsAreFocused: this.pauseWhenOtherApplicationsAreFocused,
            pauseWhenOtherApplicationsAreMaximized: this.pauseWhenOtherApplicationsAreMaximized
        };

        FS.writeFile(this.settingsPath, JSON.stringify(settings), (err) => { if(err)  console.log(err) });
    }

    addSaveFunctionality() {
        this.saveSettingsButton.addEventListener("click", () => {
            if (this.frameRateInput.value.length == 0) {
                new DisplayErrorMessageCommand("settings-error-text", "Invalid framerate", "error-animation").execute();
                return;
            }
            
            this.frameRate = Math.abs(parseInt(this.frameRateInput.value));
            this.pauseWhenOtherApplicationsAreFocused = (this.pauseWhenOtherApplicationsAreFocusedDropdown.currentValue === "Stop Running");
            this.pauseWhenOtherApplicationsAreMaximized = (this.pauseWhenOtherApplicationsAreMaximizedDropdown.currentValue === "Stop Running");
            this.saveSettings();

            // Now apply the settings
            ENGINE.setSettings(this.pauseWhenOtherApplicationsAreFocused, this.pauseWhenOtherApplicationsAreMaximized, this.frameRate);
        })
    }
}