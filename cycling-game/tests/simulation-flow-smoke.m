#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

static int testResult = 1;

@interface SimulationFlowDelegate : NSObject <WKNavigationDelegate>
@end

@implementation SimulationFlowDelegate

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    NSString *simulate =
        @"(() => {"
         "const game = window.ciclimoTourGame;"
         "window.confirm = () => true;"
         "game.storage.tutorialSeen = true;"
         "game.startTour(null);"
         "game.simulateCurrentStage();"
         "const overlay = document.getElementById('finishOverlay');"
         "const dashboard = document.getElementById('tourDashboard');"
         "const button = document.getElementById('replayButton');"
         "const rect = button.getBoundingClientRect();"
         "const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);"
         "return {"
           "state: game.state,"
           "completed: game.tour.completedStages,"
           "overlayHidden: overlay.classList.contains('is-hidden'),"
           "dashboardHidden: dashboard.classList.contains('is-hidden'),"
           "buttonText: button.textContent.trim(),"
           "hitId: hit && (hit.closest('button') || hit).id,"
           "buttonTop: rect.top,"
           "buttonBottom: rect.bottom,"
           "viewportHeight: innerHeight"
         "};"
         "})();";

    [webView evaluateJavaScript:simulate completionHandler:^(NSDictionary *before, NSError *simulateError) {
        BOOL resultVisible = !simulateError &&
            [before[@"state"] isEqual:@"FINISHED"] &&
            [before[@"completed"] integerValue] == 1 &&
            ![before[@"overlayHidden"] boolValue] &&
            [before[@"dashboardHidden"] boolValue] &&
            [before[@"buttonText"] containsString:@"SIGUIENTE ETAPA"] &&
            [before[@"hitId"] isEqual:@"replayButton"] &&
            [before[@"buttonTop"] doubleValue] >= 0 &&
            [before[@"buttonBottom"] doubleValue] <= [before[@"viewportHeight"] doubleValue];

        if (!resultVisible) {
            fprintf(stderr, "Resultado simulado bloqueado: %s\n",
                    (simulateError.localizedDescription ?: before.description).UTF8String);
            [NSApp terminate:nil];
            return;
        }

        NSString *continueStage =
            @"(() => {"
             "document.getElementById('replayButton').click();"
             "const game = window.ciclimoTourGame;"
             "return {"
               "state: game.state,"
               "completed: game.tour.completedStages,"
               "stageIndex: game.tour.stageIndex,"
               "raceCleared: game.race === null,"
               "overlayHidden: document.getElementById('finishOverlay').classList.contains('is-hidden'),"
               "dashboardHidden: document.getElementById('tourDashboard').classList.contains('is-hidden')"
             "};"
             "})();";
        [webView evaluateJavaScript:continueStage completionHandler:^(NSDictionary *after, NSError *continueError) {
            BOOL continued = !continueError &&
                [after[@"state"] isEqual:@"DASHBOARD"] &&
                [after[@"completed"] integerValue] == 1 &&
                [after[@"stageIndex"] integerValue] == 1 &&
                [after[@"raceCleared"] boolValue] &&
                [after[@"overlayHidden"] boolValue] &&
                ![after[@"dashboardHidden"] boolValue];
            if (continued) {
                testResult = 0;
                printf("{\"before\":\"%s\",\"after\":\"%s\"}\n",
                       before.description.UTF8String, after.description.UTF8String);
            } else {
                fprintf(stderr, "No avanzó tras simular: %s\n",
                        (continueError.localizedDescription ?: after.description).UTF8String);
            }
            [NSApp terminate:nil];
        }];
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
        CGFloat width = argc > 1 ? MAX(320, atof(argv[1])) : 390;
        CGFloat height = argc > 2 ? MAX(320, atof(argv[2])) : 844;
        NSRect frame = NSMakeRect(0, 0, width, height);

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

        SimulationFlowDelegate *delegate = [SimulationFlowDelegate new];
        webView.navigationDelegate = delegate;
        [webView loadFileURL:indexURL allowingReadAccessToURL:projectURL];
        [application run];
    }
    return testResult;
}
