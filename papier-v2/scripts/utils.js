class RawArray {
    constructor(initialSize = 10) {
        this.array = new Array(initialSize);
        this.size = 0;
        this.capacity = initialSize;
    }

    // Returns a exact array the perfect size
    getCopy() {
        let perfect = new Array(this.size);
        for (let i = 0; i < this.size; i++) {
            perfect[i] = this.array[i];
        }

        return perfect;
    }

    resize(newSize) {
        const resizedArray= new Array(newSize);

        for (let i = 0; i < this.size; i++) {
            resizedArray[i] = this.array[i];
        }

        this.array = resizedArray;
        this.capacity = newSize;
    }

    add(item) {
        this.array[this.size] = item;
        this.size++;

        if (this.size >= this.capacity) {
            this.resize(this.capacity * 2);
        }
    }

    remove(item) {
        const indexToRemove = this.array.indexOf(item);

        if (indexToRemove === -1) {
            return;
        }
        
        for (let i = indexToRemove + 1; i < this.size; i++) {
            this.array[i - 1] = this.array[i];
        }

        this.size--;

        if (this.size <= (this.capacity / 4)) {
            this.resize(Math.ceil(this.capacity / 4));
        }
    }
}

class DropDown {
    constructor(idOfMainChoice, idsOfDropdownChoices) {
        this.currentChoice = document.getElementById(idOfMainChoice);
        this.currentValue = this.currentChoice.innerText;
        this.concurrentChoices = idsOfDropdownChoices;

        this.initializeDropdown();
    }

    setCurrentValue(value) {
        this.currentValue = value;
        this.currentChoice.innerText = value;
    }

    initializeDropdown() {
        this.concurrentChoices.forEach(id => {
            const choiceElement = document.getElementById(id);

            choiceElement.addEventListener("click", () => {
                const newValue = choiceElement.innerText;
                this.setCurrentValue(newValue);
            })
        })
    }
}

class DisplayErrorMessageCommand {
    constructor (errorTextId, errorMessage, animationClass) {
        this.errorText = document.getElementById(errorTextId);
        this.originalText = this.errorText.innerText;
        this.errorMessage = errorMessage;
        this.animationClass = animationClass;
    }

    execute() {
        this.errorText.innerText = this.errorMessage;

        if (this.animationClass) {
            this.errorText.classList.add(this.animationClass);
        }

        setTimeout(() => {
            this.errorText.innerText = this.originalText;

            if (this.animationClass) {
                this.errorText.classList.remove(this.animationClass);
            }
        }, 10000)

    }
}

class SetCursorStatusCommand {
    constructor(status) {
        this.status = status;
    }

    execute() {
        document.body.style.cursor = this.status;
    }
}

class DirectoryCreatorCommand {
    constructor() {
        
    }

    execute() {
        this.createDirectory(PATH.join(__dirname, "saved_data", "settings_config"));
        this.createDirectory(PATH.join(__dirname, "saved_data", "thumbnails"));
        this.createDirectory(PATH.join(__dirname, "saved_data", "videos"));
        this.createDirectory(PATH.join(__dirname, "saved_data", "configs"));
    }

    createDirectory(path) {
        FS.mkdir(path, { recursive: true }, (err) => { if (err) console.log(err) });
    }
}