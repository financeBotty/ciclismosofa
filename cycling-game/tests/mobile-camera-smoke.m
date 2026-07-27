#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

static int testResult = 1;

@interface MobileCameraDelegate : NSObject <WKNavigationDelegate>
@property(nonatomic, strong) NSURL *outputURL;
@end

@implementation MobileCameraDelegate

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    NSString *test =
        @"(() => {"
         "const game = window.ciclimoTourGame;"
         "game.storage.tutorialSeen = true;"
         "game.startQuickRace();"
         "const followCard = document.getElementById('followCard');"
         "const returnButton = document.getElementById('returnCameraButton');"
         "const wheelTarget = game.race.cyclists.find((rider) => rider !== game.race.player);"
         "game.race.player.wheelTarget = wheelTarget;"
         "game.race.player.relayWheelTarget = null;"
         "game.hud.update();"
         "const singleWheelIndicator = !followCard.classList.contains('is-hidden') && returnButton.classList.contains('is-hidden');"
         "followCard.click();"
         "const wheelCancelledFromCard = !game.race.player.wheelTarget;"
         "game.race.player.wheelTarget = wheelTarget;"
         "game.race.player.relayWheelTarget = wheelTarget;"
         "game.hud.update();"
         "const relayWheelHidden = followCard.classList.contains('is-hidden') && getComputedStyle(followCard).visibility === 'hidden';"
         "game.race.player.wheelTarget = null;"
         "game.race.player.relayWheelTarget = null;"
         "game.hud.update();"
         "const switcher = document.getElementById('cameraSwitcher');"
         "const button = document.getElementById('sideCameraButton');"
         "game.hud.setMobileView('classification');"
         "const routeButton = document.querySelector('[data-mobile-view=\"race\"]');"
         "const routeRect = routeButton.getBoundingClientRect();"
         "const routeHit = document.elementFromPoint(routeRect.left + routeRect.width / 2, routeRect.top + routeRect.height / 2);"
         "routeButton.click();"
         "const viewAfterRoute = game.hud.mobileView;"
         "game.hud.setMobileView('classification');"
         "document.querySelector('#mobileClassificationPanel [data-return-to-race]').click();"
         "const viewAfterPanelReturn = game.hud.mobileView;"
         "game.hud.setMobileView('classification');"
         "const rect = switcher.getBoundingClientRect();"
         "const buttonRect = button.getBoundingClientRect();"
         "const hit = document.elementFromPoint(buttonRect.left + buttonRect.width / 2, buttonRect.top + buttonRect.height / 2);"
         "const before = game.cameraMode;"
         "button.click();"
         "const viewAfterCamera = game.hud.mobileView;"
         "const feed = document.getElementById('eventFeed');"
         "const desktopGroups = document.getElementById('groupsPanel');"
         "let groupsVisible = true;"
         "let groupsRows = 0;"
         "let viewAfterGroup = game.hud.mobileView;"
         "if (innerWidth <= 900) {"
           "game.hud.setMobileView('groups');"
           "groupsVisible = !document.getElementById('mobileGroupsPanel').classList.contains('is-hidden');"
           "groupsRows = document.querySelectorAll('#mobileGroupsList [data-group-index]').length;"
           "game.state = 'RACING';"
           "document.querySelector('#mobileGroupsList [data-group-index]').click();"
           "viewAfterGroup = game.hud.mobileView;"
         "}"
         "game.notify('ATAQUE DE PRUEBA', 'urgent');"
         "const message = feed.querySelector('.event-message');"
         "return {"
           "before, after: game.cameraMode, mobileView: viewAfterCamera,"
           "singleWheelIndicator, wheelCancelledFromCard, relayWheelHidden,"
           "viewAfterRoute, viewAfterPanelReturn, routeHitView: routeHit && routeHit.closest('[data-mobile-view]') && routeHit.closest('[data-mobile-view]').dataset.mobileView,"
           "groupsVisible, groupsRows, viewAfterGroup,"
           "desktopGroupsDisplay: getComputedStyle(desktopGroups).display,"
           "gapDisplay: getComputedStyle(document.querySelector('.gap-block')).display,"
           "brandDisplay: getComputedStyle(document.querySelector('.stage-brand')).display,"
           "actionDetailDisplay: getComputedStyle(document.querySelector('#attackButton small')).display,"
           "headerHeight: document.querySelector('.broadcast-header').getBoundingClientRect().height,"
           "feedZIndex: getComputedStyle(feed).zIndex,"
           "groupsZIndex: getComputedStyle(desktopGroups).zIndex,"
           "messageText: message && message.textContent,"
           "messageWidth: message ? message.getBoundingClientRect().width : 0,"
           "hitId: hit && hit.id,"
           "left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,"
           "width: rect.width, height: rect.height,"
           "viewportWidth: innerWidth, viewportHeight: innerHeight,"
           "zIndex: getComputedStyle(switcher).zIndex"
         "};"
         "})();";

    [webView evaluateJavaScript:test completionHandler:^(NSDictionary *result, NSError *error) {
        BOOL valid = !error &&
            [result isKindOfClass:NSDictionary.class] &&
            ![result[@"before"] isEqual:result[@"after"]] &&
            [result[@"singleWheelIndicator"] boolValue] &&
            [result[@"wheelCancelledFromCard"] boolValue] &&
            [result[@"relayWheelHidden"] boolValue] &&
            [result[@"brandDisplay"] isEqual:@"none"] &&
            ([result[@"viewportWidth"] doubleValue] > 900 ||
                [result[@"mobileView"] isEqual:@"race"]) &&
            ([result[@"viewportWidth"] doubleValue] > 900 ||
                ([result[@"viewAfterRoute"] isEqual:@"race"] &&
                 [result[@"viewAfterPanelReturn"] isEqual:@"race"] &&
                 [result[@"routeHitView"] isEqual:@"race"])) &&
            ([result[@"viewportWidth"] doubleValue] <= 900 ||
                [result[@"actionDetailDisplay"] isEqual:@"none"]) &&
            ([result[@"viewportWidth"] doubleValue] > 900 ||
                ([result[@"groupsVisible"] boolValue] &&
                 [result[@"groupsRows"] integerValue] > 0 &&
                 [result[@"viewAfterGroup"] isEqual:@"race"] &&
                 [result[@"desktopGroupsDisplay"] isEqual:@"none"] &&
                 [result[@"gapDisplay"] isEqual:@"none"])) &&
            [result[@"feedZIndex"] integerValue] > [result[@"groupsZIndex"] integerValue] &&
            [result[@"messageText"] isEqual:@"ATAQUE DE PRUEBA"] &&
            [result[@"messageWidth"] doubleValue] > 0 &&
            [result[@"hitId"] isEqual:@"sideCameraButton"] &&
            [result[@"height"] doubleValue] >=
                ([result[@"viewportWidth"] doubleValue] <= 900 ? 44 : 38) &&
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
        if (!valid || !self.outputURL) {
            [NSApp terminate:nil];
            return;
        }

        NSString *prepareSnapshot =
            @"(() => {"
             "const game = window.ciclimoTourGame;"
             "document.getElementById('countdownOverlay').className = 'countdown-overlay';"
             "game.state = 'PAUSED';"
             "if (innerWidth <= 900) game.hud.setMobileView('groups');"
             "game.notify('¡ATAQUE! EL PELOTÓN REACCIONA', 'urgent');"
             "return true;"
             "})();";
        [webView evaluateJavaScript:prepareSnapshot completionHandler:^(id prepared, NSError *prepareError) {
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.35 * NSEC_PER_SEC)),
                           dispatch_get_main_queue(), ^{
                WKSnapshotConfiguration *configuration = [WKSnapshotConfiguration new];
                configuration.rect = NSMakeRect(0, 0, webView.bounds.size.width, webView.bounds.size.height);
                [webView takeSnapshotWithConfiguration:configuration
                                     completionHandler:^(NSImage *image, NSError *snapshotError) {
                if (prepareError || snapshotError || !image) {
                    fprintf(stderr, "No se pudo tomar la captura: %s\n",
                            (prepareError ?: snapshotError).localizedDescription.UTF8String);
                    testResult = 1;
                } else {
                    NSBitmapImageRep *bitmap =
                        [[NSBitmapImageRep alloc] initWithData:image.TIFFRepresentation];
                    NSData *png =
                        [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
                    if (![png writeToURL:self.outputURL atomically:YES]) {
                        fprintf(stderr, "No se pudo guardar la captura.\n");
                        testResult = 1;
                    } else {
                        printf("%s\n", self.outputURL.path.UTF8String);
                    }
                }
                [NSApp terminate:nil];
                }];
            });
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
        if (argc > 3) {
            delegate.outputURL = [NSURL fileURLWithPath:@(argv[3])];
        }
        webView.navigationDelegate = delegate;
        [webView loadFileURL:indexURL allowingReadAccessToURL:projectURL];
        [application run];
    }
    return testResult;
}
