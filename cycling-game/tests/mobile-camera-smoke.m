#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

static int testResult = 1;

@interface MobileCameraDelegate : NSObject <WKNavigationDelegate>
@end

@implementation MobileCameraDelegate

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    NSString *test =
        @"(() => {"
         "const game = window.ciclimoTourGame;"
         "game.storage.tutorialSeen = true;"
         "game.startQuickRace();"
         "const button = document.getElementById('cameraButton');"
         "game.hud.setMobileView('classification');"
         "const rect = button.getBoundingClientRect();"
         "const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);"
         "const before = game.cameraMode;"
         "button.click();"
         "return {"
           "before, after: game.cameraMode, mobileView: game.hud.mobileView,"
           "label: button.textContent, hitId: hit && hit.id,"
           "left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,"
           "width: rect.width, height: rect.height,"
           "viewportWidth: innerWidth, viewportHeight: innerHeight,"
           "zIndex: getComputedStyle(button).zIndex"
         "};"
         "})();";

    [webView evaluateJavaScript:test completionHandler:^(NSDictionary *result, NSError *error) {
        BOOL valid = !error &&
            [result isKindOfClass:NSDictionary.class] &&
            ![result[@"before"] isEqual:result[@"after"]] &&
            [result[@"mobileView"] isEqual:@"race"] &&
            [result[@"hitId"] isEqual:@"cameraButton"] &&
            [result[@"height"] doubleValue] >= 44 &&
            [result[@"left"] doubleValue] >= 0 &&
            [result[@"right"] doubleValue] <= [result[@"viewportWidth"] doubleValue] &&
            [result[@"top"] doubleValue] >= 0 &&
            [result[@"bottom"] doubleValue] <= [result[@"viewportHeight"] doubleValue] &&
            [result[@"zIndex"] integerValue] >= 14;

        if (valid) {
            testResult = 0;
            printf("%s\n", result.description.UTF8String);
        } else {
            fprintf(stderr, "Fallo de cámara móvil: %s\n",
                    (error.localizedDescription ?: result.description).UTF8String);
        }
        [NSApp terminate:nil];
    }];
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = NSApplication.sharedApplication;
        [application setActivationPolicy:NSApplicationActivationPolicyProhibited];

        NSURL *projectURL =
            [NSURL fileURLWithPath:NSFileManager.defaultManager.currentDirectoryPath isDirectory:YES];
        NSURL *indexURL = [projectURL URLByAppendingPathComponent:@"index.html"];
        CGFloat viewportWidth = argc > 1 ? MAX(320, atof(argv[1])) : 390;
        CGFloat viewportHeight = argc > 2 ? MAX(320, atof(argv[2])) : 844;
        NSRect frame = NSMakeRect(0, 0, viewportWidth, viewportHeight);

        WKWebViewConfiguration *configuration = [WKWebViewConfiguration new];
        configuration.websiteDataStore = WKWebsiteDataStore.nonPersistentDataStore;
        [configuration.preferences setValue:@YES forKey:@"allowFileAccessFromFileURLs"];

        WKWebView *webView = [[WKWebView alloc] initWithFrame:frame configuration:configuration];
        NSWindow *window = [[NSWindow alloc]
            initWithContentRect:frame
                      styleMask:NSWindowStyleMaskBorderless
                        backing:NSBackingStoreBuffered
                          defer:NO];
        [window setFrameOrigin:NSMakePoint(-4000, -4000)];
        window.contentView = webView;

        MobileCameraDelegate *delegate = [MobileCameraDelegate new];
        webView.navigationDelegate = delegate;
        [webView loadFileURL:indexURL allowingReadAccessToURL:projectURL];
        [application run];
    }
    return testResult;
}
