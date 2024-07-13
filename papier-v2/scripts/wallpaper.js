class Wallpaper {
    constructor(topX, topY, width, height, displayMonitor, thumbnail, video, config, videoFrames) {
        this.topX = topX;
        this.topY = topY;
        this.width = width;
        this.height = height;
        this.displayMonitor = displayMonitor;
        this.thumbnail = thumbnail; // File path for the saved thumbnail
        this.video = video; // File path for the saved video
        this.config = config; // File path for the config
        this.videoFrames = videoFrames; // unit8 array of images
    }
}

class WallpaperList {
    constructor() {
        this.wallpapers = new RawArray(10);
        this.fetchAndStoreSavedWallpapers();
    }

    addWallpaper(wallpaper) {
        this.wallpapers.add(wallpaper);
    }

    removeWallpaper(wallpaper) {
        this.wallpapers.remove(wallpaper);
    }

    fetchAndStoreSavedWallpapers() {
        const savedDirectory = PATH.join(__dirname, "saved_data", "configs");
        const files = FS.readdirSync(savedDirectory);

        files.filter(file => PATH.extname(file) === '.json').forEach(file => {
            const filePath = PATH.join(savedDirectory, file);
            const fileContents = FS.readFileSync(filePath, 'utf8');
            const storedConfig = JSON.parse(fileContents);

            // Rebufferize config as frame buffers are lost in the json process
            const reBufferizedFrames = new RawArray(storedConfig.frames.size);
            for (let i = 0; i < storedConfig.frames.size; i++) {
                reBufferizedFrames.add(Buffer.from(storedConfig.frames.array[i].data))
            }
            
            // Create wallpaper
            const storedWallpaper = new Wallpaper(storedConfig.topX, storedConfig.topY, storedConfig.width, storedConfig.height, storedConfig.monitor, storedConfig.thumbnail, storedConfig.video, storedConfig.config, reBufferizedFrames);

            // Add wallpaper to list
            this.addWallpaper(storedWallpaper);
        });
    }
}

class CreateWallpaperCommand {
    // Takes in a javascript file object e.g. event.target.files[0]
    constructor (topX, topY, width, height, displayMonitor, videoFile, settings) {
        this.settings = settings;
        this.videoFile = videoFile;
        this.width = width;
        this.height = height;
        this.topX = topX;
        this.topY = topY;
        this.displayMonitor = displayMonitor;

        this.canvas = null;
        this.ctx = null;
        this.thumbnail = null;
        this.video = null;
        this.config = null;
        this.frames = new RawArray(10);

        this.initializeCanvas();
    }

    initializeCanvas() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    async loadVideoIntoHTMLObject() {
        const videoURL = URL.createObjectURL(this.videoFile);
        const videoPlayer = document.createElement('video');

        videoPlayer.src = videoURL;
        await new Promise((resolve, reject) => {
            videoPlayer.addEventListener('loadeddata', resolve, { once: true });
            videoPlayer.addEventListener('error', reject, { once: true });
        });

        videoPlayer.currentTime = 0.01;
        await new Promise((resolve, reject) => {
            videoPlayer.addEventListener('seeked', resolve, { once: true });
            videoPlayer.addEventListener('error', reject, { once: true });
        });

        return videoPlayer;
    }

    async saveWallpaperVideo() {
        const videoBuffer = Buffer.from(await this.videoFile.arrayBuffer());
        this.video = PATH.join(__dirname, 'saved_data', 'videos', [...Array(15)].map(() => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('') + ".mp4");

        return new Promise((resolve, reject) => {
            FS.writeFile(this.video, videoBuffer, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    saveWallpaperThumbnail(videoPlayer) {
        // Get path to save thumbnail
        this.thumbnail = PATH.join(__dirname, 'saved_data', 'thumbnails', [...Array(15)].map(() => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('') + ".png");
        console.log(FS.existsSync(this.thumbnail), this.thumbnail)

        // Draw frame on the canvas - then save
        this.ctx.drawImage(videoPlayer, 0, 0, this.width, this.height);

        // Convert canvas content to a Buffer containing PNG encoded image data
        const dataURL = this.canvas.toDataURL('image/png');

        // Remove the prefix from the dataURL
        const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");

        // Convert the base64 string to a Buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Write buffer to the file system
        return new Promise((resolve, reject) => {
            FS.writeFile(this.thumbnail, buffer, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    saveWallpaperConfig() {
        this.config = PATH.join(__dirname, "saved_data", "configs", [...Array(15)].map(() => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('') + ".json");

        const wallpaperConfig = {
            "thumbnail": this.thumbnail,
            "video": this.video,
            "frames": this.frames.getCopy(),
            "width": this.width,
            "height": this.height,
            "topX": this.topX,
            "topY": this.topY,
            "monitor": this.displayMonitor,
            "config": this.config
        }

        return new Promise((resolve, reject) => {
            const jsonData = JSON.stringify(wallpaperConfig);
            FS.writeFile(this.config, jsonData, 'utf8', (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async loadVideoHTMLObjectIntoFrames(videoPlayer) {
        const totalFrames = videoPlayer.duration * this.settings.frameRate;
        const frameInterval = videoPlayer.duration / totalFrames;

        // Save frames of wallpaper
        for (let i = 0; i < totalFrames; i++) {
            const currentTime = i * frameInterval;
            videoPlayer.currentTime = currentTime;

            await new Promise((resolve, reject) => {
                videoPlayer.addEventListener('seeked', resolve, { once: true });
                videoPlayer.addEventListener('error', reject, { once: true });
            });

            // Draw frame on the canvas
            this.ctx.drawImage(videoPlayer, 0, 0, this.width, this.height);

            const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
            const data = imageData.data;

            // Convert RGB to BGR using Uint32Array for faster processing
            const uint32Data = new Uint32Array(data.buffer);

            for (let j = 0; j < uint32Data.length; j++) {
                const pixel = uint32Data[j];
    
                const r = (pixel >> 0) & 0xFF;   // Corrected: Extract red channel
                const g = (pixel >> 8) & 0xFF;   // Corrected: Extract green channel
                const b = (pixel >> 16) & 0xFF;  // Corrected: Extract blue channel
                const a = (pixel >> 24) & 0xFF;  // Corrected: Extract alpha channel
    
                uint32Data[j] = (r << 16) | (g << 8) | (b << 0) | (a << 24); // Reassign as BGR with correct alpha
            }

            // Convert canvas to uint8 array and save
            // const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
            const buffer = Buffer.from(imageData.data.buffer);
            this.frames.add(buffer);
        }
    }

    async unlinkIfExists(filePath) {
        try {
            await FS.promises.stat(filePath); // Check if file exists
            await FS.promises.unlink(filePath); // Delete the file
        } catch (err) {
            return;
        }
    }

    async execute() {
        try {
            // Let the user know that the process is loading
            new SetCursorStatusCommand("progress").execute();

            const videoPlayer = await this.loadVideoIntoHTMLObject();

            await this.loadVideoHTMLObjectIntoFrames(videoPlayer).catch((err) => {
                console.log(err)
                new DisplayErrorMessageCommand("add-wallpaper-info-text", "Failed to load video frames, try again.", "error-animation").execute();
                throw new Error("Can't load wallpaper");
            });

            await this.saveWallpaperThumbnail(videoPlayer).catch((err) => {
                console.log(err)
                new DisplayErrorMessageCommand("add-wallpaper-info-text", "Failed to load thumbnail, try again.", "error-animation").execute();
                throw new Error("Can't load wallpaper");
            });

            await this.saveWallpaperVideo().catch((err) => {
                console.log(err)
                new DisplayErrorMessageCommand("add-wallpaper-info-text", "Couldn't load video, try again.", "error-animation").execute();
                throw new Error("Can't load wallpaper");
            })

            // Save wallpaper config
            await this.saveWallpaperConfig().catch((err) => {
                console.log(err)
                new DisplayErrorMessageCommand("add-wallpaper-info-text", "Failed to process video, it is too large, try turning down the framerate or trimming the video length.", "error-animation").execute();
                throw new Error("Can't load wallpaper");
            });

            new SetCursorStatusCommand("default").execute();

            return new Wallpaper(this.topX, this.topY, this.width, this.height, this.displayMonitor, this.thumbnail, this.video, this.config, this.frames);
        } catch (error) {
            // If we can't load the wallpaper, delete the saved files we have stored and return
            this.unlinkIfExists(this.thumbnail),
            this.unlinkIfExists(this.video),
            this.unlinkIfExists(this.config);
            new SetCursorStatusCommand("default").execute();
            return null;
        }
    }
}

class RemoveWallpaperCommand {
    constructor(wallpaper, wallpaperList) {
        this.wallpaper = wallpaper;
        this.wallpaperList = wallpaperList;
    }

    execute() {
        // Delete saved files
        FS.unlinkSync(this.wallpaper.config);
        FS.unlinkSync(this.wallpaper.video);
        FS.unlinkSync(this.wallpaper.thumbnail);

        // Remove from concurrent list
        this.wallpaperList.removeWallpaper(this.wallpaper);
    }
}

class SaveExistingWallpaperCommand {
    constructor(wallpaper) {
        this.wallpaper = wallpaper;
        this.newConfig = null;
    }

    execute() {
        // Delete current config
        FS.unlinkSync(this.wallpaper.config);

        // Save new config
        this.newConfig = PATH.join(__dirname, "saved_data", "configs", [...Array(15)].map(() => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('') + ".json");
        this.wallpaper.config = this.newConfig;

        const wallpaperConfig = {
            "thumbnail": this.wallpaper.thumbnail,
            "video": this.wallpaper.video,
            "frames": this.wallpaper.videoFrames,
            "width": this.wallpaper.width,
            "height": this.wallpaper.height,
            "topX": this.wallpaper.topX,
            "topY": this.wallpaper.topY,
            "monitor": this.wallpaper.displayMonitor,
            "config": this.newConfig
        }

        const jsonData = JSON.stringify(wallpaperConfig);

        FS.writeFileSync(this.newConfig, jsonData, 'utf8');
    }
}

class LoadWallpaperAsBackgroundCommand {
    constructor(wallpaper) {
        this.wallpaper = wallpaper;
        this.played = false;
    }

    async execute() {
        const wallpaper = this.wallpaper;

        new SetCursorStatusCommand("progress");
        ENGINE.addWallpaper(wallpaper.topX, wallpaper.topY, wallpaper.width, wallpaper.height, wallpaper.displayMonitor, wallpaper.videoFrames.getCopy());
        if (this.played == false) ENGINE.play();
        this.played = true;
        new SetCursorStatusCommand("default");
    }
}

class WallpaperConfigurator {
    constructor() {
        this.wallpaperToConfigurePreview = document.getElementById("selected-wallpaper-to-edit-preview");
        this.saveWallpaperSettingsButton = document.getElementById("save-wallpaper-settings-button")
        this.wallpaperWidthInput = document.getElementById("wallpaper-width-setting");
        this.wallpaperHeightInput = document.getElementById("wallpaper-height-setting");
        this.wallpaperTopXInput = document.getElementById("wallpaper-topx-setting");
        this.wallpaperTopYInput = document.getElementById("wallpaper-topy-setting");
        this.wallpaperDisplayMonitorInput = document.getElementById("wallpaper-display-monitor-setting");

        this.wallpaperToConfigure = null;
        this.loadWallpaperAsBackgroundCommand = new LoadWallpaperAsBackgroundCommand(this.wallpaperToConfigure);

        this.addSaveAndLoadFunctionality();
    }

    setConfiguredWallpaperSettings(wallpaper) {
        this.wallpaperWidthInput.value = wallpaper.width;
        this.wallpaperHeightInput.value = wallpaper.height;
        this.wallpaperTopXInput.value = wallpaper.topX;
        this.wallpaperTopYInput.value = wallpaper.topY;
        this.wallpaperDisplayMonitorInput.value = wallpaper.displayMonitor;
        this.wallpaperToConfigurePreview.style.backgroundImage = "url('" + wallpaper.thumbnail.substring(2).replace(/\\/g, "/") + "')";
        this.wallpaperToConfigure = wallpaper;
    }

    clearConfiguredWallpaperSettings() {
        this.wallpaperWidthInput.value = "";
        this.wallpaperHeightInput.value = "";
        this.wallpaperTopXInput.value = "";
        this.wallpaperTopYInput.value = "";
        this.wallpaperDisplayMonitorInput.value = "";
        this.wallpaperToConfigurePreview.style.backgroundImage = "none";
        this.wallpaperToConfigure = null;
    }

    getConfiguredWallpaperSettings() {
        const width = Math.abs(parseInt(this.wallpaperWidthInput.value));
        const height = Math.abs(parseInt(this.wallpaperHeightInput.value));
        const topX = Math.abs(parseInt(this.wallpaperTopXInput.value));
        const topY = Math.abs(parseInt(this.wallpaperTopYInput.value));
        const displayMonitor = Math.abs(parseInt(this.wallpaperDisplayMonitorInput.value));

        return {
            "width": width,
            "height": height,
            "topX": topX,
            "topY": topY,
            "displayMonitor": displayMonitor
        }
    }

    addSaveAndLoadFunctionality() {
        this.saveWallpaperSettingsButton.addEventListener("click", async () => {
            if (this.wallpaperToConfigure == null) {
                new DisplayErrorMessageCommand("wallpaper-error-text", "Select a wallpaper first", "error-animation").execute();
                return;
            }
            
            const screenDetails = await window.getScreenDetails();
            const monitors = screenDetails.screens.length;
            const newSettings = this.getConfiguredWallpaperSettings();

            if (newSettings.displayMonitor > monitors) {
                new DisplayErrorMessageCommand("wallpaper-error-text", "Display monitor out of bounds", "error-animation").execute();
                return;
            }

            this.wallpaperToConfigure.topX = newSettings.topX;
            this.wallpaperToConfigure.topY = newSettings.topY;
            this.wallpaperToConfigure.width = newSettings.width;
            this.wallpaperToConfigure.height = newSettings.height;
            this.wallpaperToConfigure.displayMonitor = newSettings.displayMonitor;
            this.loadWallpaperAsBackgroundCommand.wallpaper = this.wallpaperToConfigure;

            // Save config
            new SaveExistingWallpaperCommand(this.wallpaperToConfigure).execute();
            // Run wallpaper
            this.loadWallpaperAsBackgroundCommand.execute();
        })
    }

}

class WallpaperPanel {
    constructor (wallpaperList, wallpaperLoader, wallpaperConfigurator) {
        this.wallpaperList = wallpaperList;
        this.wallpaperLoader = wallpaperLoader;
        this.wallpaperConfigurator = wallpaperConfigurator;
        this.panel = document.getElementById("stored-wallpapers-panel");
        this.selectedWallpaperPreview = document.getElementById("selected-wallpaper-preview");

        new SetCursorStatusCommand("progress");
        this.displayWallpapers();
        new SetCursorStatusCommand("default");
    }

    clearPanel() {
        const wallpaperPanels = document.getElementsByClassName("main-section-listed-pair-of-wallpapers-container");

        Array.from(wallpaperPanels).forEach(pair => {
            pair.remove();
        })
    }

    createPanelRow() {
        const panelRow = document.createElement("div");
        panelRow.className = "main-section-listed-pair-of-wallpapers-container";

        return panelRow;
    }

    createWallpaperCreateButton() {
        // Create button with css
        const newWallpaperItem = document.createElement('div');
        newWallpaperItem.className = "main-section-listed-wallpapers";

        const newWallpaperLabel = document.createElement("label");
        newWallpaperLabel.className = "main-section-listed-wallpapers-add-wallpaper-input";
        newWallpaperLabel.setAttribute("for", "add-wallpaper-upload");
        newWallpaperLabel.style.backgroundImage = "url('" + PATH.join(__dirname, "images", "website").replace(/\\/g, "/") + "/add-icon.svg')";

        const newWallpaperInput = document.createElement("input");
        newWallpaperInput.setAttribute("type", "file");
        newWallpaperInput.setAttribute("accept", ".mp4");
        newWallpaperInput.id = "add-wallpaper-upload";

        newWallpaperItem.appendChild(newWallpaperLabel);
        newWallpaperItem.appendChild(newWallpaperInput);

        // Add functionality
        newWallpaperInput.addEventListener("change", async (event) => {
            const videoFile = event.target.files[0];
            if (!videoFile) return;

            await this.wallpaperLoader.loadNewWallpaper(videoFile);
            this.clearPanel();
            this.displayWallpapers();
        })

        return newWallpaperItem;
    }

    createWallpaperItem(wallpaper) {
        // Create elements for each wallpaper
        const newWallpaperItem = document.createElement('div');
        newWallpaperItem.className = "main-section-listed-wallpapers"; // Assuming you have a class for individual wallpapers
        newWallpaperItem.style.backgroundImage = `url('${wallpaper.thumbnail.substring(2).replace(/\\/g, "/")}')`; // Assuming each wallpaper object has a thumbnail property

        const wallpaperActionButtonContainer = document.createElement('div');
        wallpaperActionButtonContainer.className = "main-section-listed-wallpaper-action-buttons-container";

        const selectWallpaperItemButton = document.createElement("button");
        selectWallpaperItemButton.className = "main-section-listed-wallpaper-action-button";
        selectWallpaperItemButton.innerText = "Select";
        wallpaperActionButtonContainer.appendChild(selectWallpaperItemButton);
       
        const removeWallpaperItemButton = document.createElement("button");
        removeWallpaperItemButton.className = "main-section-listed-wallpaper-action-button";
        removeWallpaperItemButton.innerText = "Remove";
        wallpaperActionButtonContainer.appendChild(removeWallpaperItemButton);

        newWallpaperItem.appendChild(wallpaperActionButtonContainer);

        // Add remove functionality
        removeWallpaperItemButton.addEventListener("click", () => {
            // Can't remove the current background
            if (this.wallpaperConfigurator.wallpaperToConfigure == wallpaper) {
                new DisplayErrorMessageCommand("wallpaper-error-text", "Can't delete selected wallpaper.", "error-animation").execute();
                return;
            }

            newWallpaperItem.remove();
            new RemoveWallpaperCommand(wallpaper, this.wallpaperList).execute();
            this.wallpaperConfigurator.clearConfiguredWallpaperSettings();
            this.clearPanel();
            this.displayWallpapers();
        })
        
        // Show the wallpaper settings
        selectWallpaperItemButton.addEventListener("click", () => {
            this.wallpaperConfigurator.setConfiguredWallpaperSettings(wallpaper);
            this.selectedWallpaperPreview.style.backgroundImage = newWallpaperItem.style.backgroundImage;
        })

        return newWallpaperItem;
    }

    displayWallpapers() {
        new SetCursorStatusCommand("progress").execute();

        const length = this.wallpaperList.wallpapers.size;

        // Add stored wallpapers
        let panelRow = null;
        for (let i = 0; i < length; i+=2) {
            // console.log(this.wallpaperList.wallpapers.array);
            panelRow = this.createPanelRow();
            panelRow.appendChild(this.createWallpaperItem(this.wallpaperList.wallpapers.array[i]));

            // Create second wallpaper if there is, otherwise add the "add wallpaper button"
            if (i + 1 < length) {
                // console.log("second", this.wallpaperList.wallpapers[i + 1]);
                panelRow.appendChild(this.createWallpaperItem(this.wallpaperList.wallpapers.array[i + 1]));
            }

            this.panel.appendChild(panelRow);
        }

        // Add "add new wallpaper" button
        const isCurrentPanelRowFull = panelRow ? (panelRow.children.length === 2) : true; // If panel row is null as we have no saved files, simply just move on and act as if the row was filled!
        const addNewWallpaperButton = this.createWallpaperCreateButton();

        if (isCurrentPanelRowFull) { // Create new row
            panelRow = this.createPanelRow();
            this.panel.appendChild(panelRow);
        }

        panelRow.appendChild(addNewWallpaperButton);
        new SetCursorStatusCommand("default").execute();
    }
}

class PauseOrPlayToggle {
    constructor() {
        this.toggleStatus = document.getElementById("pause-or-play-toggle-status-text");
        this.toggle = document.getElementById("pause-or-play-toggle");
        this.addToggleFunctionality();
    }

    addToggleFunctionality() {
        this.toggle.addEventListener("change", (event) => {
            const isPlaying = event.target.checked;

            if (isPlaying) {
                ENGINE.showBackground();
                ENGINE.play();

                this.toggleStatus.innerText = "Currently Active";
            } else {
                ENGINE.pause();
                ENGINE.hideBackground();

                this.toggleStatus.innerText = "Currently Inactive";
            }
        })
    }
}

class AddWallpaperWidget {
    constructor(wallpaperLoader, wallpaperPanel) {
        this.wallpaperLoader = wallpaperLoader;
        this.wallpaperPanel = wallpaperPanel;
        this.addWallpaperButton = document.getElementById("extra-add-wallpaper-upload");
        this.initialize();
    }

    initialize() {
        this.addWallpaperButton.addEventListener("change", async (event) => {
            const videoFile = event.target.files[0];
            if (!videoFile) return;

            await this.wallpaperLoader.loadNewWallpaper(videoFile);
            this.wallpaperPanel.clearPanel();
            this.wallpaperPanel.displayWallpapers();
        });
    }
}

class WallpaperLoader {
    constructor(wallpaperList, wallpaperConfigurator, settings) {
        this.wallpaperList = wallpaperList;
        this.settings = settings;
        this.wallpaperConfigurator = wallpaperConfigurator;
    }

    async loadNewWallpaper(videoFile) {
        const newWallpaper = await new CreateWallpaperCommand(0, 0, 1920, 1080, 1, videoFile, this.settings).execute();
        if (newWallpaper) this.wallpaperList.addWallpaper(newWallpaper);
    }
}