#include <nan.h>
#include <node_buffer.h>
#include <windows.h>
#include <iostream>
#include <vector>
#include <chrono>
#include <thread>
#include <atomic>

struct PaintParams
{
    HWND desktopHWND;
    HBITMAP hBitmap;
    int monitor;
    int x;
    int y;
    int width;
    int height;
};

class Wallpaper {
    public:
        void addFrameFromBuffer(v8::Local<v8::Object> buffer) {
            unsigned char *bufferData = reinterpret_cast<unsigned char *>(node::Buffer::Data(buffer));

            // Step 1: Prepare BITMAPINFO structure
            BITMAPINFO bmi = { 0 };
            bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
            bmi.bmiHeader.biWidth = width;
            bmi.bmiHeader.biHeight = -height;  // Negative height for top-down DIB
            bmi.bmiHeader.biPlanes = 1;
            bmi.bmiHeader.biBitCount = 32;     // 32-bit RGBA
            bmi.bmiHeader.biCompression = BI_RGB;

            // Step 2: Allocate memory for pixel data
            void* pBits = nullptr;
            HDC hdc = GetDC(nullptr);
            HBITMAP hBitmap = CreateDIBSection(hdc, &bmi, DIB_RGB_COLORS, &pBits, nullptr, 0);
            ReleaseDC(nullptr, hdc);

            if (hBitmap == NULL) {
                return;
            }

            // Step 3: Copy pixel data into the bitmap
            BYTE* pDest = static_cast<BYTE*>(pBits);
            int stride = width * 4; // 4 bytes per pixel (RGBA)

            for (int y = 0; y < height; ++y)
            {
                memcpy(pDest, bufferData + y * stride, stride);
                pDest += stride;
            }

            frames.push_back(hBitmap);
        }

        void addFrame(HBITMAP frame) {
            this->frames.push_back(frame);
        }

        void setMonitor(int monitor) {
            this->monitor = monitor;
        }

        void setX(int x) {
            this->x = x;
        }

        void setY(int y) {
            this->y = y;
        }

        void setWidth(int width) {
            this->width = width;
        }

        void setHeight(int height) {
            this->height = height;
        }

        void updateFrame() {
            this->currentFrame = (this->currentFrame+1) % this->frames.size();
        }

        std::vector<HBITMAP> getFrames() const {
            return frames;
        }

        int getMonitor() const {
            return monitor;
        }

        int getX() const {
            return x;
        }

        int getY() const {
            return y;
        }

        int getWidth() const {
            return width;
        }

        int getHeight() const {
            return height;
        }

        int getCurrentFrame() {
            return this->currentFrame;
        }

        HBITMAP getCurrentFrameAsBitmap() {
            return this->frames[this->currentFrame];
        }

    private:
        std::vector<HBITMAP> frames;
        int monitor = 1; 
        int x = 0; 
        int y = 0; 
        int width = 500; 
        int height = 500;
        int currentFrame = 0;
};

class Settings {
    public:
        static Settings& getInstance() {
            static Settings instance;
            return instance;
        }

        void setFrameRate(int newFrameRate) {
            frameRate = newFrameRate;
        }

        void setPauseStatusWhenOtherApplicationsAreFocused(bool pauseStatus) {
            _pauseWhenOtherApplicationsAreFocused = pauseStatus;
        }

        void setPauseStatusWhenOtherApplicationsAreMaximized(bool pauseStatus) {
            _pauseWhenOtherApplicationsAreMaximized = pauseStatus;
        }

        bool pauseWhenOtherApplicationsAreFocused() {
            return _pauseWhenOtherApplicationsAreFocused;
        }

        bool pauseWhenOtherApplicationsAreMaximized() {
            return _pauseWhenOtherApplicationsAreMaximized;
        }

        bool getIfAnyWindowsAreFocused() {
            return thereIsAnotherApplicationFocused;
        }

        bool getIfAnyWindowsAreMaximized() {
            return thereisAnotherApplicationMaximized;
        }

        int getFrameRate() {
            return frameRate;
        }

        void disableSettingsTracker() {
            if (hMinimizeStartHook) {
                UnhookWinEvent(hMinimizeStartHook);
                hMinimizeStartHook = nullptr;
            }

            if (foregroundChangeHook) {
                UnhookWinEvent(foregroundChangeHook);
                foregroundChangeHook = nullptr;
            }
        }

        void trackFocusedAndMaximizedApplications() {
            disableSettingsTracker(); // Unhook any existing hooks
            hMinimizeStartHook = SetWinEventHook(EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_LOCATIONCHANGE, nullptr, trackResizes, 0, 0, WINEVENT_OUTOFCONTEXT);
            foregroundChangeHook = SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, nullptr, trackForegroundChanges, 0, 0, WINEVENT_OUTOFCONTEXT);
        }

    private:
        Settings() {}
        ~Settings() {
            disableSettingsTracker();
        }

        bool _pauseWhenOtherApplicationsAreFocused = true;
        bool _pauseWhenOtherApplicationsAreMaximized = true;
        bool thereIsAnotherApplicationFocused = false;
        bool thereisAnotherApplicationMaximized = false;
        bool checkPointerForFocusedApplications = false;
        bool checkPointerForMaximizedApplications = false;
        int frameRate = 16;
        HWINEVENTHOOK hMinimizeStartHook;
        HWINEVENTHOOK foregroundChangeHook;

        static BOOL CALLBACK isMaximizedWindow(HWND hwnd, LPARAM lParam) {
            if (IsWindowVisible(hwnd) && IsZoomed(hwnd)) {
                *reinterpret_cast<bool*>(lParam) = true; // Turn stored bool to true
                return FALSE; // Stop enumeration
            }
            return TRUE; // Continue enumeration
        }

        static void isDesktopFocused(HWND currentFocusedWindow, bool* lParam) {
            const int bufferSize = 5;
            char windowTitle[bufferSize];
            const int lengthOfWindowName = GetWindowText(currentFocusedWindow, windowTitle, bufferSize);

            if (lengthOfWindowName != 0) {
                *lParam = true;
                return;
            }

            *lParam = false;
        }

        static void CALLBACK trackResizes(HWINEVENTHOOK hWinEventHook, DWORD event, HWND hwnd, LONG idObject, LONG idChild, DWORD dwEventThread, DWORD dwmsEventTime) {
            if (idObject != OBJID_WINDOW) { // Only take calls from window objects
                return;
            }

            if ((GetWindowLongPtr(hwnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW) != 0) { // Don't take calls from preview windows (hovered windows)
                return;
            }

            Settings& settings = getInstance();
            settings.checkPointerForMaximizedApplications = false;
            settings.checkPointerForFocusedApplications = false;

            EnumWindows(settings.isMaximizedWindow, reinterpret_cast<LPARAM>(&settings.checkPointerForMaximizedApplications));
            isDesktopFocused(GetForegroundWindow(), &settings.checkPointerForFocusedApplications);

            settings.thereIsAnotherApplicationFocused = settings.checkPointerForFocusedApplications;
            settings.thereisAnotherApplicationMaximized = settings.checkPointerForMaximizedApplications;
        }

        static void CALLBACK trackForegroundChanges(HWINEVENTHOOK hWinEventHook, DWORD event, HWND hwnd, LONG idObject, LONG idChild, DWORD dwEventThread, DWORD dwmsEventTime) {
            Settings& settings = getInstance();
            settings.checkPointerForMaximizedApplications = false;
            settings.checkPointerForFocusedApplications = false;

            EnumWindows(settings.isMaximizedWindow, reinterpret_cast<LPARAM>(&settings.checkPointerForMaximizedApplications));
            isDesktopFocused(hwnd, &settings.checkPointerForFocusedApplications);

            settings.thereIsAnotherApplicationFocused = settings.checkPointerForFocusedApplications;
            settings.thereisAnotherApplicationMaximized = settings.checkPointerForMaximizedApplications;
        }
};

class Painter {
    public:
        void enableDesktopCanvas() {
            // Show the desktop canvas
            ShowWindow(desktopWindow, SW_SHOW);
        }

        void disableDesktopCanvas() {
            // Hide the desktop canvas
            ShowWindow(desktopWindow, SW_HIDE);
        }

        void paintBitmapOnDesktop(HBITMAP hBitmap, int monitor, int x, int y, int width, int height) {
            PaintParams params = { desktopWindow, hBitmap, monitor, x, y, width, height };
            EnumDisplayMonitors(nullptr, nullptr, paint, reinterpret_cast<LPARAM>(&params));
        }

        Painter() {
            findDesktopWindow();
        }

    private:
        HWND desktopWindow;

        static BOOL CALLBACK findDesktopHWND(HWND tophandle, LPARAM topparamhandle) {
            HWND p = FindWindowEx(tophandle, nullptr, "SHELLDLL_DefView", nullptr);

            if (p != nullptr) {
                Painter* painter = reinterpret_cast<Painter*>(topparamhandle);
                painter->desktopWindow = FindWindowEx(nullptr, tophandle, "WorkerW", nullptr);
            }

            return TRUE; // Continue enumeration
        }

        static BOOL CALLBACK paint(HMONITOR hMonitor, HDC hdcMonitor, LPRECT lprcMonitor, LPARAM dwData) {
            PaintParams* params = reinterpret_cast<PaintParams*>(dwData);

            params->monitor--;

            if (params->monitor != 0) {
                return TRUE;
            }

            MONITORINFO mi = { sizeof(mi) };
            GetMonitorInfo(hMonitor, &mi);
            int topLeftX = mi.rcMonitor.left;
            int topLeftY = mi.rcMonitor.top;

            HWND workerw = params->desktopHWND;
            HDC hdcWorkerW = GetDC(workerw);

            if (!hdcWorkerW) {
                std::cerr << "Failed to get device context of worker window." << std::endl;
                return FALSE;
            }

            HDC hdcMem = CreateCompatibleDC(hdcWorkerW);
            if (!hdcMem) {
                std::cerr << "Failed to create compatible DC." << std::endl;
                ReleaseDC(workerw, hdcWorkerW);
                return FALSE;
            }

            HBITMAP hOldBitmap = (HBITMAP)SelectObject(hdcMem, params->hBitmap);

            if (hOldBitmap == NULL) {
                std::cerr << "Failed to select bitmap into memory DC." << std::endl;
                DeleteDC(hdcMem);
                ReleaseDC(workerw, hdcWorkerW);
                return FALSE;
            }

            if (!BitBlt(hdcWorkerW, topLeftX + params->x, topLeftY + params->y, params->width, params->height, hdcMem, 0, 0, SRCCOPY)) {
                std::cerr << "BitBlt failed." << std::endl;
            }

            SelectObject(hdcMem, hOldBitmap);
            DeleteDC(hdcMem);
            ReleaseDC(workerw, hdcWorkerW);

            return FALSE;
        }

        void findDesktopWindow() {
            HWND progman = FindWindow("Progman", nullptr);

            DWORD_PTR result = 0;
            SendMessageTimeout(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, &result);

            EnumWindows(findDesktopHWND, reinterpret_cast<LPARAM>(this));
        }
};

class Animator {
    public:
        ~Animator() {
            stop();
        }

        void addWallpaper(Wallpaper wallpaper) {
            // Check for wallpapers with the same display monitor, and if so, delete that one and in with the new!
            for (auto& concurrentWallpaper : wallpapers) {
                if (concurrentWallpaper.getMonitor() == wallpaper.getMonitor()) {
                    concurrentWallpaper = wallpaper;
                    return;
                }
            }

            wallpapers.push_back(wallpaper);
        }

        void clearWallpapers() {
            wallpapers.clear();
        }

        void stop() {
            playing = false;
            if (animationThread.joinable() && animationThread.get_id() != std::this_thread::get_id()) { // Only join the thread if operating from the outside thread
                animationThread.join();
                animationThread = std::thread(); // Reset the thread after joining
            }
        }

        void pause() {
            playing = false;
        }

        void play() {
            if (painter == nullptr || settings == nullptr) {
                return;
            }
            
            // Check if animation thread is joinable, indicating an alive thread
            if (animationThread.joinable()) {
                animationThread.join(); // Join the thread to properly terminate it
            }

            playing = true;
            animationThread = std::thread(&Animator::animate, this);
        }

        void setPainter(Painter* _painter) {
            painter = _painter;
        }

        void setSettings(Settings* _settings) {
            settings = _settings;
        }

    private:
        std::atomic<bool> playing{ true };
        std::thread animationThread;
        std::vector<Wallpaper> wallpapers;
        Painter* painter = nullptr;
        Settings* settings = nullptr;

        void animate() {
            // Track settings
            settings->trackFocusedAndMaximizedApplications();
            
            std::chrono::time_point<std::chrono::steady_clock> lastFrameTime = std::chrono::steady_clock::now();
            std::chrono::time_point<std::chrono::steady_clock> currentTime;
            const std::chrono::duration<double> frameDuration(1.0 / settings->getFrameRate());

            while (playing) {
                currentTime = std::chrono::steady_clock::now();
                std::chrono::duration<double> elapsed_time = currentTime - lastFrameTime;

                if (elapsed_time >= frameDuration) {
                    if ((settings->pauseWhenOtherApplicationsAreFocused() && settings->getIfAnyWindowsAreFocused()) || (settings->pauseWhenOtherApplicationsAreMaximized() && settings->getIfAnyWindowsAreMaximized())) {
                        MSG msg; // Process the message queue to check for focused and maximized windows
                        while (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE)) {
                            TranslateMessage(&msg);
                            DispatchMessage(&msg);
                        }

                        continue;
                    }

                    for (auto& wallpaper : wallpapers) {
                        // std::cout << "Animation going to play " << wallpaper.getCurrentFrame() << std::endl;
                        painter->paintBitmapOnDesktop(wallpaper.getCurrentFrameAsBitmap(), wallpaper.getMonitor(), wallpaper.getX(), wallpaper.getY(), wallpaper.getWidth(), wallpaper.getHeight());
                        wallpaper.updateFrame();
                    }

                    lastFrameTime = currentTime;
                    MSG msg; // Process the message queue to check for focused and maximized windows
                    while (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE)) {
                        TranslateMessage(&msg);
                        DispatchMessage(&msg);
                    }
                }
            }

            // Stop tracking and thread when not playing! This way we can play again and keep the memory and threads clean!
            settings->disableSettingsTracker();
        }
};

Painter painter;
Animator animator;
Settings& settings = Settings::getInstance(); // Obtain singleton instance

void initialize(const Nan::FunctionCallbackInfo<v8::Value> &info) {
    painter.enableDesktopCanvas();
    animator.setPainter(&painter);
    animator.setSettings(&settings);
}

void setSettings(const Nan::FunctionCallbackInfo<v8::Value> &info) {
    const bool pauseWhenOtherApplicationsAreFocused = info[0].As<v8::Boolean>()->Value();
    const bool pauseWhenOtherApplicationsAreMaximized= info[1].As<v8::Boolean>()->Value();
    const int framerate = info[2].As<v8::Int32>()->Value();

    settings.setPauseStatusWhenOtherApplicationsAreFocused(pauseWhenOtherApplicationsAreFocused);
    settings.setPauseStatusWhenOtherApplicationsAreMaximized(pauseWhenOtherApplicationsAreMaximized);
    settings.setFrameRate(framerate);
}

void addWallpaper(const Nan::FunctionCallbackInfo<v8::Value> &info) {
    int topX = info[0].As<v8::Int32>()->Value();
    int topY = info[1].As<v8::Int32>()->Value();
    int width = info[2].As<v8::Int32>()->Value();
    int height = info[3].As<v8::Int32>()->Value();
    int displayMonitor = info[4].As<v8::Int32>()->Value();

    v8::Local<v8::Array> buffers = info[5].As<v8::Array>();
    v8::Local<v8::Context> ctx = info.GetIsolate()->GetCurrentContext();

    // Create new wallpaper
    Wallpaper newWallpaper;
    newWallpaper.setX(topX);
    newWallpaper.setY(topY);
    newWallpaper.setWidth(width);
    newWallpaper.setHeight(height);
    newWallpaper.setMonitor(displayMonitor);

    // Add frames to new wallpaper
    for (int i = 0; i < buffers->Length(); i++) {
        v8::Local<v8::Value> bufferItem = buffers->Get(ctx, i).ToLocalChecked();
        v8::Local<v8::Object> buffer = bufferItem.As<v8::Object>();
        newWallpaper.addFrameFromBuffer(buffer);
    }

    // Add wallpaper to animate
    animator.addWallpaper(newWallpaper);
}

void play(const Nan::FunctionCallbackInfo<v8::Value> &info) {
    animator.play();
}

void pause(const Nan::FunctionCallbackInfo<v8::Value> &info) {
    animator.pause();
}

void showBackground(const Nan::FunctionCallbackInfo<v8::Value> &info) {
    painter.enableDesktopCanvas();
}

void hideBackground(const Nan::FunctionCallbackInfo<v8::Value> &info) {
    painter.disableDesktopCanvas();
}

NAN_MODULE_INIT(Init)
{
    Nan::SetMethod(target, "initialize", initialize);
    Nan::SetMethod(target, "setSettings", setSettings);
    Nan::SetMethod(target, "addWallpaper", addWallpaper);
    Nan::SetMethod(target, "play", play);
    Nan::SetMethod(target, "pause", pause);
    Nan::SetMethod(target, "hideBackground", hideBackground);
    Nan::SetMethod(target, "showBackground", showBackground);
}

NAN_MODULE_WORKER_ENABLED(engine, Init);