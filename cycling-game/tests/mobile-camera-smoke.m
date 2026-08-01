#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

static int testResult = 1;

@interface MobileCameraDelegate : NSObject <WKNavigationDelegate>
@property(nonatomic, strong) NSURL *outputURL;
@property(nonatomic, copy) NSString *snapshotMode;
@end

@implementation MobileCameraDelegate

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    NSString *test =
        @"(() => {"
         "const game = window.ciclimoTourGame;"
         "Date.now = () => 1700000000000;"
         "Math.random = () => 0.3141592653;"
         "game.storage.tutorialSeen = true;"
         "game.startQuickRace();"
         "const followCard = document.getElementById('followCard');"
         "const returnButton = document.getElementById('returnCameraButton');"
         "const wheelTarget = game.race.cyclists.find((rider) => rider !== game.race.player);"
         "game.race.player.wheelTarget = wheelTarget;"
         "game.race.player.relayWheelTarget = null;"
         "game.hud.update();"
         "const singleWheelIndicator = !followCard.classList.contains('is-hidden') && returnButton.classList.contains('is-hidden');"
         "const wheelRect = followCard.getBoundingClientRect();"
         "const wheelIndicatorCompact = followCard.classList.contains('wheel-compact') && wheelRect.height <= 30 && wheelRect.width <= 100;"
         "const wheelNoAge = !followCard.textContent.toLowerCase().includes('años');"
         "game.hud.followCardUntil = performance.now() - 1;"
         "game.hud.update();"
         "const wheelIndicatorExpires = followCard.classList.contains('is-hidden');"
         "followCard.click();"
         "const wheelCancelledFromCard = !game.race.player.wheelTarget;"
         "game.race.player.wheelTarget = wheelTarget;"
         "game.race.player.relayWheelTarget = wheelTarget;"
         "game.hud.update();"
         "const relayWheelHidden = followCard.classList.contains('is-hidden') && getComputedStyle(followCard).visibility === 'hidden';"
         "wheelTarget.jerseyType = 'polka';"
         "wheelTarget.jerseyColor = '#f7f4ea';"
         "game.race.player.relayWheelTarget = null;"
         "game.hud.followCardRider = null;"
         "game.hud.followCardMode = '';"
         "game.hud.update();"
         "const jerseyBadge = document.getElementById('followRiderJersey');"
         "const jerseyShownOnClick = !followCard.classList.contains('wheel-compact') &&"
           " !jerseyBadge.hidden && jerseyBadge.dataset.jersey === 'polka' &&"
           " jerseyBadge.textContent.includes('MONTAÑA');"
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
         "const panelReturn = document.querySelector('#mobileClassificationPanel [data-return-to-race]');"
         "panelReturn.click();"
         "const viewAfterPanelReturn = game.hud.mobileView;"
         "const panelsHiddenAfterReturn = [...document.querySelectorAll('.mobile-view-panel')].every((panel) => panel.classList.contains('is-hidden'));"
         "game.hud.setMobileView('classification');"
         "game.hud.setMobileView('race');"
         "const rect = switcher.getBoundingClientRect();"
         "const buttonRect = button.getBoundingClientRect();"
         "const hit = document.elementFromPoint(buttonRect.left + buttonRect.width / 2, buttonRect.top + buttonRect.height / 2);"
         "const before = game.cameraMode;"
         "button.click();"
         "const viewAfterCamera = game.hud.mobileView;"
         "const feed = document.getElementById('eventFeed');"
         "const desktopGroups = document.getElementById('groupsPanel');"
         "const gapBlock = document.querySelector('.gap-block');"
         "const stageBrand = document.querySelector('.stage-brand');"
         "const activeControlButtons = [...document.querySelectorAll('.controls-panel button')].filter((item) => item.getBoundingClientRect().width > 0);"
         "const aggressiveFontSize = parseFloat(getComputedStyle(document.querySelector('[data-risk=\"aggressive\"] span')).fontSize);"
         "const headerLabelFontSize = parseFloat(getComputedStyle(document.querySelector('.broadcast-header .data-block .label')).fontSize);"
         "const headerValueFontSize = parseFloat(getComputedStyle(document.querySelector('.broadcast-header .data-block strong')).fontSize);"
         "const visibleHeaderValues = [...document.querySelectorAll('.broadcast-header .data-block strong')].filter((item) => item.getBoundingClientRect().width > 0);"
         "const headerTextFits = visibleHeaderValues.every((item) => item.scrollWidth <= item.clientWidth + 1);"
         "const headerClipped = visibleHeaderValues.filter((item) => item.scrollWidth > item.clientWidth + 1).map((item) => `${item.id || item.parentElement.className}:${item.scrollWidth}/${item.clientWidth}`);"
         "const lateralRiderScale = game.lateralRiderViewportScale();"
         "const topRiderScale = game.topRiderViewportScale();"
         "const touchTargetsValid = activeControlButtons.every((item) => { const box = item.getBoundingClientRect(); return box.width >= 43.5 && box.height >= 44; });"
         "const legacyProfileRemoved = !document.getElementById('riderProfileSelect') && !document.getElementById('profileOption');"
         "let groupsVisible = true;"
         "let groupsRows = 0;"
         "let viewAfterGroup = game.hud.mobileView;"
         "game.hud.setMobileView('groups');"
         "groupsVisible = !document.getElementById('mobileGroupsPanel').classList.contains('is-hidden');"
         "groupsRows = document.querySelectorAll('#mobileGroupsList [data-group-index]').length;"
         "game.state = 'RACING';"
         "document.querySelector('#mobileGroupsList [data-group-index]').click();"
         "viewAfterGroup = game.hud.mobileView;"
         "const boxInsideViewport = (selector) => {"
           "const element = document.querySelector(selector);"
           "if (!element) return false;"
           "const style = getComputedStyle(element);"
           "const box = element.getBoundingClientRect();"
           "return style.display !== 'none' && style.visibility !== 'hidden' &&"
             "box.width > 0 && box.height > 0 && box.left >= -1 && box.top >= -1 &&"
             "box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1;"
         "};"
         "const tabAuditValid = ['groups', 'classification', 'stage'].every((view) => {"
           "const tab = document.querySelector(`[data-mobile-view=\"${view}\"]`);"
           "tab.click();"
           "const panel = document.getElementById(`mobile${view[0].toUpperCase()}${view.slice(1)}Panel`);"
           "const tabBox = tab.getBoundingClientRect();"
           "const hitTarget = document.elementFromPoint(tabBox.left + tabBox.width / 2, tabBox.top + tabBox.height / 2);"
           "return game.hud.mobileView === view && tab.classList.contains('active') &&"
             "tab.getAttribute('aria-selected') === 'true' && !panel.classList.contains('is-hidden') &&"
             "boxInsideViewport(`#${panel.id}`) && hitTarget && hitTarget.closest('[data-mobile-view]') === tab;"
         "});"
         "routeButton.click();"
         "game.toggleTeamOrders();"
         "const teamOrderPanel = document.getElementById('teamOrderPanel');"
         "const teamOrderButtons = [...teamOrderPanel.querySelectorAll('[data-team-order]')];"
         "const teamOrderPanelBox = teamOrderPanel.getBoundingClientRect();"
         "const teamOrderFontSize = parseFloat(getComputedStyle(teamOrderButtons[0].querySelector('span')).fontSize);"
         "const teamOrderMinButtonHeight = Math.min(...teamOrderButtons.map((item) => item.getBoundingClientRect().height));"
         "const teamOrderColumns = getComputedStyle(teamOrderPanel.querySelector('[role=group]')).gridTemplateColumns.trim().split(/\\s+/).length;"
         "const teamOrdersValid = !teamOrderPanel.classList.contains('is-hidden') &&"
           "boxInsideViewport('#teamOrderPanel') && document.getElementById('teamOrderButton').getAttribute('aria-expanded') === 'true' &&"
           "teamOrderButtons.length === 4 && teamOrderColumns === 2 &&"
           "teamOrderMinButtonHeight >= (innerWidth > 900 ? 72 : 51) &&"
           "teamOrderFontSize >= (innerWidth > 900 ? 15 : 11);"
         "game.closeTeamOrders();"
         "game.pause();"
         "const pauseOverlayValid = !document.getElementById('pauseOverlay').classList.contains('is-hidden') &&"
           "boxInsideViewport('#pauseOverlay .compact-card');"
         "game.resume();"
         "game.openTeamsDirectory();"
         "const teamsDirectoryValid = !document.getElementById('teamsDirectoryOverlay').classList.contains('is-hidden') &&"
           "boxInsideViewport('#teamsDirectoryOverlay .team-browser-shell') &&"
           "document.querySelectorAll('#teamDirectoryTabs button').length === 10;"
         "game.closeTeamsDirectory();"
         "game.openTeamSelection(1);"
         "const selectionShell = document.querySelector('#teamSelectionOverlay .team-browser-shell');"
         "const selectionButton = document.getElementById('confirmTeamSelectionButton');"
         "selectionShell.scrollTop = selectionShell.scrollHeight;"
         "const selectionShellBox = selectionShell.getBoundingClientRect();"
         "const selectionButtonBox = selectionButton.getBoundingClientRect();"
         "const selectionCanScroll = selectionShell.scrollHeight > selectionShell.clientHeight + 1;"
         "const selectionButtonSticky = getComputedStyle(selectionButton).position === 'sticky' &&"
           "(!selectionCanScroll || (selectionButtonBox.top >= selectionShellBox.top - 1 && selectionButtonBox.top <= selectionShellBox.top + 16)) &&"
           "boxInsideViewport('#confirmTeamSelectionButton');"
         "const teamSelectionValid = !document.getElementById('teamSelectionOverlay').classList.contains('is-hidden') &&"
           "boxInsideViewport('#teamSelectionOverlay .team-browser-shell') &&"
           "document.querySelectorAll('#teamSelectionGrid .team-select-card').length === 10 && selectionButtonSticky;"
         "selectionShell.scrollTop = 0;"
         "game.closeTeamSelection();"
         "game.openTutorial();"
         "const tutorialValid = !document.getElementById('tutorialOverlay').classList.contains('is-hidden') &&"
           "boxInsideViewport('#tutorialOverlay > article');"
         "document.getElementById('tutorialOverlay').classList.add('is-hidden');"
         "game.state = 'RACING';"
         "game.notify('ATAQUE DE PRUEBA', 'urgent');"
         "const message = feed.querySelector('.event-message');"
         "const tabsRect = document.getElementById('mobileViewTabs').getBoundingClientRect();"
         "const speedRect = document.getElementById('raceSpeedButton').getBoundingClientRect();"
         "const cameraRect = switcher.getBoundingClientRect();"
         "const floatingNavigationSeparated = tabsRect.right <= speedRect.left && speedRect.right <= cameraRect.left;"
         "const racePointCard = document.getElementById('racePointCard');"
         "followCard.classList.remove('is-hidden');"
         "racePointCard.classList.remove('is-hidden');"
         "game.hud.resolvePopupPriority();"
         "const popupPriorityValid = !followCard.classList.contains('is-hidden') && racePointCard.classList.contains('is-hidden');"
         "followCard.classList.add('is-hidden');"
         "const normalSprite = game.buildSideCyclistSprite('#ffcc33', true, 0, 'leader', 'normal', '');"
         "const standingSprite = game.buildSideCyclistSprite('#ffcc33', true, 0, 'leader', 'standing', '');"
         "const normalPixels = normalSprite.getContext('2d').getImageData(0, 0, normalSprite.width, normalSprite.height).data;"
         "const standingPixels = standingSprite.getContext('2d').getImageData(0, 0, standingSprite.width, standingSprite.height).data;"
         "let posePixelDifference = 0;"
         "for (let pixel = 0; pixel < normalPixels.length; pixel += 4) {"
           "if (normalPixels[pixel] !== standingPixels[pixel] ||"
               " normalPixels[pixel + 1] !== standingPixels[pixel + 1] ||"
               " normalPixels[pixel + 2] !== standingPixels[pixel + 2] ||"
               " normalPixels[pixel + 3] !== standingPixels[pixel + 3]) posePixelDifference += 1;"
         "}"
         "return {"
           "before, after: game.cameraMode, mobileView: viewAfterCamera,"
           "singleWheelIndicator, wheelIndicatorCompact, wheelNoAge, wheelIndicatorExpires, wheelCancelledFromCard, relayWheelHidden, jerseyShownOnClick,"
           "viewAfterRoute, viewAfterPanelReturn, panelsHiddenAfterReturn,"
           "routeHitView: routeHit && routeHit.closest('[data-mobile-view]') && routeHit.closest('[data-mobile-view]').dataset.mobileView,"
           "groupsVisible, groupsRows, viewAfterGroup,"
           "tabAuditValid, teamOrdersValid, teamOrderColumns, teamOrderFontSize, teamOrderMinButtonHeight, teamOrderPanelWidth: teamOrderPanelBox.width, pauseOverlayValid, teamsDirectoryValid, teamSelectionValid, selectionButtonSticky, tutorialValid,"
           "desktopGroupsDisplay: getComputedStyle(desktopGroups).display,"
           "gapDisplay: gapBlock ? getComputedStyle(gapBlock).display : 'none',"
           "brandDisplay: stageBrand ? getComputedStyle(stageBrand).display : 'none',"
           "actionDetailDisplay: getComputedStyle(document.querySelector('#attackButton small')).display,"
           "headerHeight: document.querySelector('.broadcast-header').getBoundingClientRect().height,"
           "feedZIndex: getComputedStyle(feed).zIndex,"
           "groupsZIndex: getComputedStyle(desktopGroups).zIndex,"
           "messageText: message && message.textContent,"
           "messageWidth: message ? message.getBoundingClientRect().width : 0,"
           "posePixelDifference,"
           "aggressiveFontSize, headerLabelFontSize, headerValueFontSize, headerTextFits, headerClipped, lateralRiderScale, topRiderScale,"
           "touchTargetsValid, legacyProfileRemoved,"
           "floatingNavigationSeparated, popupPriorityValid,"
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
            [result[@"wheelIndicatorCompact"] boolValue] &&
            [result[@"wheelNoAge"] boolValue] &&
            [result[@"wheelIndicatorExpires"] boolValue] &&
            [result[@"wheelCancelledFromCard"] boolValue] &&
            [result[@"relayWheelHidden"] boolValue] &&
            [result[@"jerseyShownOnClick"] boolValue] &&
            [result[@"brandDisplay"] isEqual:@"none"] &&
            [result[@"mobileView"] isEqual:@"race"] &&
            [result[@"viewAfterRoute"] isEqual:@"race"] &&
            [result[@"viewAfterPanelReturn"] isEqual:@"race"] &&
            [result[@"panelsHiddenAfterReturn"] boolValue] &&
            [result[@"routeHitView"] isEqual:@"race"] &&
            [result[@"actionDetailDisplay"] isEqual:@"none"] &&
            [result[@"groupsVisible"] boolValue] &&
            [result[@"groupsRows"] integerValue] > 0 &&
            [result[@"viewAfterGroup"] isEqual:@"race"] &&
            [result[@"desktopGroupsDisplay"] isEqual:@"none"] &&
            [result[@"gapDisplay"] isEqual:@"none"] &&
            [result[@"tabAuditValid"] boolValue] &&
            [result[@"teamOrdersValid"] boolValue] &&
            [result[@"pauseOverlayValid"] boolValue] &&
            [result[@"teamsDirectoryValid"] boolValue] &&
            [result[@"teamSelectionValid"] boolValue] &&
            [result[@"tutorialValid"] boolValue] &&
            [result[@"feedZIndex"] integerValue] > [result[@"groupsZIndex"] integerValue] &&
            [result[@"messageText"] isEqual:@"ATAQUE DE PRUEBA"] &&
            [result[@"messageWidth"] doubleValue] > 0 &&
            [result[@"posePixelDifference"] integerValue] >= 100 &&
            [result[@"aggressiveFontSize"] doubleValue] >=
                ([result[@"viewportWidth"] doubleValue] > 900 ? 14 :
                  [result[@"viewportWidth"] doubleValue] <= 360 ? 6.3 : 6.5) &&
            [result[@"headerLabelFontSize"] doubleValue] >=
                ([result[@"viewportWidth"] doubleValue] > 900 ? 7 : 9) &&
            [result[@"headerValueFontSize"] doubleValue] >=
                ([result[@"viewportWidth"] doubleValue] > 900 ? 15 : 19) &&
            [result[@"headerTextFits"] boolValue] &&
            [result[@"lateralRiderScale"] doubleValue] >=
                ([result[@"viewportWidth"] doubleValue] > 900 ? 1 : 0.73) &&
            [result[@"topRiderScale"] doubleValue] >=
                ([result[@"viewportWidth"] doubleValue] > 900 ? 1 : 1.12) &&
            [result[@"touchTargetsValid"] boolValue] &&
            [result[@"legacyProfileRemoved"] boolValue] &&
            [result[@"floatingNavigationSeparated"] boolValue] &&
            [result[@"popupPriorityValid"] boolValue] &&
            [result[@"hitId"] isEqual:@"sideCameraButton"] &&
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
                    (error.description ?: result.description).UTF8String);
        }
        if (!valid || !self.outputURL) {
            [NSApp terminate:nil];
            return;
        }

        BOOL poseSnapshot = [self.snapshotMode isEqualToString:@"normal"] ||
            [self.snapshotMode isEqualToString:@"standing"];
        BOOL roadSnapshot = poseSnapshot || [self.snapshotMode isEqualToString:@"finish"];
        NSString *focusExpression = [self.snapshotMode isEqualToString:@"finish"]
            ? @"Math.max(0, game.race.road.lengthKm - 0.22)"
            : @"(game.race.road.mountains[0]"
               " ? Math.max(0, game.race.road.mountains[0].km - 0.35)"
               " : Math.max(0, game.race.road.lengthKm - 0.22))";
        NSString *prepareSnapshot = [NSString stringWithFormat:
            @"(() => {"
             "const game = window.ciclimoTourGame;"
             "document.getElementById('countdownOverlay').className = 'countdown-overlay';"
             "game.state = 'PAUSED';"
             "game.cameraFocusKm = %@;"
             "game.race.player.distance = game.cameraFocusKm;"
             "%@"
             "game.render();"
             "game.hud.setMobileView('%@');"
             "%@"
             "return true;"
             "})();",
             focusExpression,
             poseSnapshot
                ? [NSString stringWithFormat:
                    @"game.race.timeTrial = true;"
                     "game.race.raceVehicles.forEach((vehicle) => vehicle.active = false);"
                     "game.race.player.lateral = 0;"
                     "game.race.player.targetLateral = 0;"
                     "game.race.player.energy = 80;"
                     "game.race.player.fatigue = 10;"
                     "game.race.player.sprinting = false;"
                     "game.race.player.effort = %@;"
                     "game.race.player.attacking = %@;",
                     [self.snapshotMode isEqualToString:@"standing"] ? @"4" : @"2",
                     [self.snapshotMode isEqualToString:@"standing"] ? @"2" : @"0"]
                : @"",
             roadSnapshot ? @"race" : @"groups",
             roadSnapshot ? @"" : @"game.notify('¡ATAQUE! EL PELOTÓN REACCIONA', 'urgent');"];
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
        delegate.snapshotMode = argc > 4 ? @(argv[4]) : @"climb";
        if (argc > 3) {
            delegate.outputURL = [NSURL fileURLWithPath:@(argv[3])];
        }
        webView.navigationDelegate = delegate;
        [webView loadFileURL:indexURL allowingReadAccessToURL:projectURL];
        [application run];
    }
    return testResult;
}
