// @ts-check
/**
 * Page Binding Profiler Webview JavaScript
 * Manages waterfall timeline, event log, view filter chips, and live counter updates
 */
(function () {
    // @ts-ignore - VS Code API
    const vscode = acquireVsCodeApi();

    /** @type {Map<string, WaterfallEntry>} */
    const waterfallEntries = new Map();

    /** @type {Array<RecordingEvent>} */
    const eventLog = [];

    let totalDurationMs = 0;
    let autoScroll = true;
    let pendingRender = false;
    let recordingStartTime = 0;
    let durationTimer = null;

    // Profiler state machine: 'idle' | 'reloading' | 'recording' | 'complete' | 'imported'
    var profilerState = 'idle';

    // Module-level state for zoom
    let zoomStartMs = null;
    let zoomEndMs = null;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartMs = 0;

    // Module-level state for effective duration (shared by cursor and zoom)
    let currentEffectiveDuration = 100;

    // Module-level state for row selection
    let selectedBindingKey = null;

    // Constants
    var LABEL_COLUMN_WIDTH = 320;
    var TIMELINE_RIGHT_MARGIN = 16;

    // DOM elements
    const counterTotal = document.getElementById('counterTotal');
    const counterPending = document.getElementById('counterPending');
    const counterResolved = document.getElementById('counterResolved');
    const counterErrors = document.getElementById('counterErrors');
    const waterfallRows = document.getElementById('waterfallRows');
    const waterfallEmpty = document.getElementById('waterfallEmpty');
    const waterfallTimeHeader = document.getElementById('waterfallTimeHeader');
    const waterfallCount = document.getElementById('waterfallCount');
    const eventLogContainer = document.getElementById('eventLogContainer');
    const eventLogEmpty = document.getElementById('eventLogEmpty');
    const eventLogCount = document.getElementById('eventLogCount');
    const statusBadge = document.getElementById('statusBadge');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const exportBtn = document.getElementById('exportBtn');
    const durationDisplay = document.getElementById('durationDisplay');
    const eventCountDisplay = document.getElementById('eventCountDisplay');
    const pollRateDisplay = document.getElementById('pollRateDisplay');
    const pollRateSelect = document.getElementById('pollRateSelect');
    const waterfallContainer = document.getElementById('waterfallContainer');
    const timeCursor = document.getElementById('timeCursor');
    const zoomOverlay = document.getElementById('zoomOverlay');
    const resetZoomBtn = document.getElementById('resetZoomBtn');
    const waterfallTooltip = document.getElementById('waterfallTooltip');
    const contextMenu = document.getElementById('contextMenu');
    const refreshBtn = document.getElementById('refreshBtn');
    const importBtn = document.getElementById('importBtn');
    const sortToggleBtn = document.getElementById('sortToggleBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const sessionSelect = document.getElementById('sessionSelect');
    const pageSelect = document.getElementById('pageSelect');
    const viewFilterBar = document.getElementById('viewFilterBar');
    const groupToggleBtn = document.getElementById('groupToggleBtn');
    const reloadRecordBtn = document.getElementById('reloadRecordBtn');
    const cancelReloadBtn = document.getElementById('cancelReloadBtn');
    const reloadStatus = document.getElementById('reloadStatus');

    // View filter chip state
    var activeViewFilter = null; // null = show all, string = filter to view name
    var pageViewOptions = []; // { id, label, viewPath } from extension

    // Module-level state for event log sorting
    var eventLogSortBy = 'time'; // 'time' or 'duration'
    var lastRenderedSortMode = 'time';
    var lastRenderedViewFilter = null;
    var renderedEventCount = 0;

    // Dirty flag for waterfall rendering (Fix 2)
    var waterfallDirty = true;

    // Event log cap (Fix 3)
    var MAX_EVENT_LOG_SIZE = 50000;
    var eventLogCapped = false;

    // Debounced view chip discovery (Fix 6)
    var discoveredViewNames = new Set();
    var viewChipsDirty = false;

    // Virtual scrolling and grouping state
    var displayList = []; // Array of {type:'entry', entry} or {type:'group-header', ...}
    var ROW_HEIGHT = 22; // Matches .waterfall-row CSS height
    var OVERSCAN = 10; // Extra rows rendered above/below viewport
    var lastVisibleFirst = -1;
    var lastVisibleLast = -1;

    var groupingEnabled = false;
    var collapsedGroups = new Set();

    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================

    function setProfilerState(newState) {
        profilerState = newState;

        switch (newState) {
            case 'idle':
                if (startBtn) startBtn.disabled = false;
                if (startBtn) startBtn.style.display = '';
                if (stopBtn) stopBtn.disabled = true;
                if (refreshBtn) refreshBtn.disabled = true;
                setDropdownsEnabled(true);
                if (reloadRecordBtn) reloadRecordBtn.disabled = !(pageSelect && pageSelect.value);
                if (cancelReloadBtn) cancelReloadBtn.style.display = 'none';
                break;

            case 'reloading':
                if (startBtn) startBtn.disabled = true;
                if (startBtn) startBtn.style.display = '';
                if (stopBtn) stopBtn.disabled = true;
                if (refreshBtn) refreshBtn.disabled = true;
                setDropdownsEnabled(false);
                if (reloadRecordBtn) reloadRecordBtn.disabled = true;
                if (cancelReloadBtn) cancelReloadBtn.style.display = '';
                break;

            case 'recording':
                if (startBtn) startBtn.style.display = 'none';
                if (stopBtn) stopBtn.disabled = false;
                if (refreshBtn) refreshBtn.disabled = false;
                setDropdownsEnabled(false);
                if (reloadRecordBtn) reloadRecordBtn.disabled = true;
                if (cancelReloadBtn) cancelReloadBtn.style.display = 'none';
                break;

            case 'complete':
                if (startBtn) startBtn.disabled = false;
                if (startBtn) startBtn.style.display = '';
                if (stopBtn) stopBtn.disabled = true;
                if (refreshBtn) refreshBtn.disabled = false;
                setDropdownsEnabled(true);
                if (reloadRecordBtn) reloadRecordBtn.disabled = !(pageSelect && pageSelect.value);
                if (cancelReloadBtn) cancelReloadBtn.style.display = 'none';
                break;

            case 'imported':
                if (startBtn) startBtn.disabled = true;
                if (startBtn) startBtn.style.display = '';
                if (stopBtn) stopBtn.disabled = true;
                if (refreshBtn) refreshBtn.disabled = true;
                setDropdownsEnabled(false);
                if (reloadRecordBtn) reloadRecordBtn.disabled = true;
                if (cancelReloadBtn) cancelReloadBtn.style.display = 'none';
                break;
        }
    }

    function setDropdownsEnabled(enabled) {
        if (sessionSelect) sessionSelect.disabled = !enabled;
        if (pageSelect) pageSelect.disabled = !enabled;
        if (pollRateSelect) pollRateSelect.disabled = !enabled;
    }

    // ============================================================================
    // MESSAGE HANDLING
    // ============================================================================

    window.addEventListener('message', function (event) {
        const message = event.data;
        switch (message.command) {
            case 'profilerOpened':
                handleProfilerOpened();
                break;
            case 'recordingStarted':
                handleRecordingStarted(message);
                break;
            case 'recordingEvents':
                handleRecordingEvents(message.batch);
                break;
            case 'recordingComplete':
                handleRecordingComplete(message);
                break;
            case 'recordingStopped':
                handleRecordingStopped(message);
                break;
            case 'error':
                handleError(message.message);
                break;
            case 'snapshotLoaded':
                handleSnapshotLoaded(message.data);
                break;
            case 'scopeOptions':
                handleScopeOptions(message);
                break;
            case 'reloadingStarted':
                handleReloadingStarted(message);
                break;
            case 'reloadingStatus':
                handleReloadingStatus(message);
                break;
            case 'reloadingCancelled':
                handleReloadingCancelled();
                break;
            case 'pageViews':
                handlePageViews(message.views);
                break;
        }
    });

    // Signal ready
    vscode.postMessage({ command: 'ready' });

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================

    function handleProfilerOpened() {
        waterfallEntries.clear();
        eventLog.length = 0;
        totalDurationMs = 0;
        if (durationTimer) {
            clearInterval(durationTimer);
            durationTimer = null;
        }

        // Reset zoom
        zoomStartMs = null;
        zoomEndMs = null;
        if (resetZoomBtn) resetZoomBtn.style.display = 'none';

        // Clear render throttle timer
        if (renderThrottleTimer) {
            clearTimeout(renderThrottleTimer);
            renderThrottleTimer = null;
        }

        updateStatus('idle', 'Idle');
        updateCounters(0, 0, 0, 0);
        setProfilerState('idle');

        // Reset sort mode and event log for fresh render
        lastRenderedSortMode = 'force-rerender';
        lastRenderedViewFilter = null;
        renderedEventCount = 0;
        if (eventLogContainer) eventLogContainer.innerHTML = '';

        // Reset waterfall empty text
        if (waterfallEmpty) {
            waterfallEmpty.textContent = 'Select a session and page above to begin';
        }

        // Reset poll rate display
        if (pollRateDisplay) pollRateDisplay.textContent = '';

        // Reset dirty flags
        waterfallDirty = true;
        eventLogCapped = false;
        discoveredViewNames = new Set();
        viewChipsDirty = false;

        // Reset virtual scroll and grouping state
        displayList = [];
        collapsedGroups.clear();
        lastVisibleFirst = -1;
        lastVisibleLast = -1;
        if (groupToggleBtn) groupToggleBtn.style.display = 'none';

        requestRender();
    }

    function handleRecordingStarted(data) {
        waterfallEntries.clear();
        eventLog.length = 0;
        totalDurationMs = 0;
        recordingStartTime = Date.now();

        // Reset zoom
        zoomStartMs = null;
        zoomEndMs = null;
        if (resetZoomBtn) resetZoomBtn.style.display = 'none';

        // Clear render throttle timer
        if (renderThrottleTimer) {
            clearTimeout(renderThrottleTimer);
            renderThrottleTimer = null;
        }
        lastRenderTime = 0;

        updateStatus('recording', 'Recording...');
        updateCounters(data.totalCount || 0, data.pendingCount || 0, data.resolvedCount || 0, data.errorCount || 0);
        setProfilerState('recording');

        // Clear reload status text (may persist from a reload cycle)
        if (reloadStatus) reloadStatus.textContent = '';

        // Display poll rate
        if (pollRateDisplay && data.pollIntervalMs) {
            pollRateDisplay.textContent = 'Poll: ' + data.pollIntervalMs + 'ms';
        }

        // Reset sort mode and event log for fresh render
        lastRenderedSortMode = 'force-rerender';
        lastRenderedViewFilter = null;
        renderedEventCount = 0;
        if (eventLogContainer) eventLogContainer.innerHTML = '';

        // Update waterfall empty text for recording mode
        if (waterfallEmpty) {
            waterfallEmpty.textContent = 'Waiting for binding state changes...';
        }

        // Reset dirty flags
        waterfallDirty = true;
        eventLogCapped = false;
        discoveredViewNames = new Set();
        viewChipsDirty = false;

        // Reset virtual scroll and grouping state
        displayList = [];
        collapsedGroups.clear();
        lastVisibleFirst = -1;
        lastVisibleLast = -1;
        if (groupToggleBtn) groupToggleBtn.style.display = 'none';

        // Start a timer to update duration display in real-time
        if (durationTimer) clearInterval(durationTimer);
        durationTimer = setInterval(function () {
            if (profilerState === 'recording') {
                totalDurationMs = Date.now() - recordingStartTime;
                renderFooter();
            }
        }, 250);

        requestRender();
    }

    function handleRecordingEvents(batch) {
        if (!batch) return;

        // Update counters
        updateCounters(batch.totalCount || 0, batch.pendingCount || 0, batch.resolvedCount || 0, batch.errorCount || 0);

        // Process events
        const events = batch.events || [];
        if (events.length > 0) {
            waterfallDirty = true;
        }
        for (const event of events) {
            processEvent(event);
        }

        // Update duration from latest event
        if (events.length > 0) {
            const lastEvent = events[events.length - 1];
            if (lastEvent.relativeMs > totalDurationMs) {
                totalDurationMs = lastEvent.relativeMs;
            }
        }

        requestRender();
    }

    function handleRecordingComplete(data) {
        if (durationTimer) {
            clearInterval(durationTimer);
            durationTimer = null;
        }
        totalDurationMs = Date.now() - recordingStartTime;
        var reason = data.reason || 'unknown';

        updateStatus('complete', 'Complete (' + reason + ')');
        setProfilerState('complete');

        if (data.pendingCount !== undefined) {
            updateCounters(data.totalCount || 0, data.pendingCount || 0, data.resolvedCount || 0, data.errorCount || 0);
        }

        requestRender();
    }

    function handleRecordingStopped(data) {
        if (durationTimer) {
            clearInterval(durationTimer);
            durationTimer = null;
        }
        totalDurationMs = data.durationMs || Date.now() - recordingStartTime;
        updateStatus('complete', 'Stopped');
        setProfilerState('complete');

        if (eventCountDisplay) {
            eventCountDisplay.textContent = (data.totalEventsRecorded || eventLog.length) + ' events';
        }

        requestRender();
    }

    function handleError(msg) {
        updateStatus('complete', 'Error');
        console.error('Recording error:', msg);
        // Return to idle if we weren't recording
        if (profilerState !== 'recording') {
            setProfilerState('idle');
        }
    }

    function handleSnapshotLoaded(data) {
        // Clear existing state
        waterfallEntries.clear();
        eventLog.length = 0;
        if (eventLogContainer) eventLogContainer.innerHTML = '';
        lastRenderedSortMode = 'force-rerender';
        lastRenderedViewFilter = null;
        renderedEventCount = 0;
        waterfallDirty = true;
        eventLogCapped = false;
        displayList = [];
        collapsedGroups.clear();
        lastVisibleFirst = -1;
        lastVisibleLast = -1;

        if (durationTimer) {
            clearInterval(durationTimer);
            durationTimer = null;
        }
        totalDurationMs = data.durationMs || 0;

        // Reconstruct waterfall entries
        var waterfallData = data.waterfall || [];
        for (var i = 0; i < waterfallData.length; i++) {
            var w = waterfallData[i];
            var imported = {
                key: w.key,
                label: w.label,
                componentPath: w.componentPath,
                propertyPath: w.propertyPath,
                bindingType: w.bindingType,
                ticks: w.ticks || [],
                firstEventMs: w.ticks && w.ticks.length > 0 ? w.ticks[0].ms : 0,
                state: w.ticks && w.ticks.length > 0 ? w.ticks[w.ticks.length - 1].state : 'unknown',
                sortKey: null
            };
            imported.sortKey = waterfallSortKey(imported);
            waterfallEntries.set(w.key, imported);
        }

        // Reconstruct event log
        var events = data.events || [];
        for (var j = 0; j < events.length; j++) {
            eventLog.push(events[j]);
        }

        updateStatus('complete', 'Imported');
        setProfilerState('imported');

        // Reset zoom
        zoomStartMs = null;
        zoomEndMs = null;
        if (resetZoomBtn) resetZoomBtn.style.display = 'none';

        requestRender();
    }

    function handleScopeOptions(message) {
        populateSelect(sessionSelect, message.sessions, message.currentSessionId);
        populateSelect(pageSelect, message.pages, message.currentPageId);

        // Update reload button state based on whether a page is selected
        if (reloadRecordBtn && (profilerState === 'idle' || profilerState === 'complete')) {
            reloadRecordBtn.disabled = !(pageSelect && pageSelect.value);
        }
    }

    function handlePageViews(views) {
        pageViewOptions = views || [];
        renderViewFilterChips();
    }

    function handleReloadingStarted(data) {
        updateStatus('reloading', 'Reloading...');
        setProfilerState('reloading');

        // Clear data for fresh recording when view reloads
        waterfallEntries.clear();
        eventLog.length = 0;
        if (eventLogContainer) eventLogContainer.innerHTML = '';
        lastRenderedSortMode = 'force-rerender';
        lastRenderedViewFilter = null;
        renderedEventCount = 0;
        waterfallDirty = true;
        eventLogCapped = false;
        discoveredViewNames = new Set();
        viewChipsDirty = false;
        displayList = [];
        collapsedGroups.clear();
        lastVisibleFirst = -1;
        lastVisibleLast = -1;
        if (groupToggleBtn) groupToggleBtn.style.display = 'none';
        updateCounters(0, 0, 0, 0);

        if (waterfallEmpty) {
            waterfallEmpty.textContent = 'Reloading "' + (data.viewPath || '') + '"...';
        }
        if (reloadStatus) {
            reloadStatus.textContent = '';
        }

        requestRender();
    }

    function handleReloadingStatus(data) {
        if (reloadStatus) {
            reloadStatus.textContent = data.message || '';
        }
    }

    function handleReloadingCancelled() {
        updateStatus('idle', 'Idle');
        setProfilerState('idle');

        if (reloadStatus) reloadStatus.textContent = '';
        if (waterfallEmpty) {
            waterfallEmpty.textContent = 'Select a session and page above to begin';
        }

        requestRender();
    }

    function populateSelect(selectEl, options, currentValue) {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        for (var i = 0; i < options.length; i++) {
            var opt = document.createElement('option');
            opt.value = options[i].id;
            opt.textContent = options[i].label;
            if (options[i].viewPath) {
                opt.setAttribute('data-view-path', options[i].viewPath);
            }
            if (options[i].id === currentValue) {
                opt.selected = true;
            }
            selectEl.appendChild(opt);
        }
    }

    function getSortedEventLog() {
        if (eventLogSortBy === 'duration') {
            return eventLog.slice().sort(function (a, b) {
                return b.cycleDuration - a.cycleDuration;
            });
        }
        return eventLog;
    }

    // ============================================================================
    // EVENT PROCESSING
    // ============================================================================

    function processEvent(event) {
        var isBaseline = event.baseline === true;
        var key = event.componentPath + '::' + event.propertyPath;

        // Update waterfall entry
        var entry = waterfallEntries.get(key);
        if (!entry) {
            entry = {
                key: key,
                label: shortLabel(event.componentPath, event.propertyPath),
                componentPath: event.componentPath,
                propertyPath: event.propertyPath,
                bindingType: event.bindingType,
                ticks: [],
                firstEventMs: event.relativeMs,
                state: event.newState,
                sortKey: null // pre-computed in next step
            };
            waterfallEntries.set(key, entry);
        }

        // Pre-compute sort key on entry creation or update (Fix 2)
        if (entry.sortKey === null) {
            entry.sortKey = waterfallSortKey(entry);
        }

        // Compute cycle duration (time since previous non-baseline tick for this binding)
        var cycleDuration = 0;
        if (!isBaseline) {
            for (var k = entry.ticks.length - 1; k >= 0; k--) {
                if (!entry.ticks[k].baseline) {
                    cycleDuration = event.relativeMs - entry.ticks[k].ms;
                    break;
                }
            }
        }

        // Add to event log with cycle duration
        eventLog.push({
            key: key,
            relativeMs: event.relativeMs,
            label: shortLabel(event.componentPath, event.propertyPath),
            previousState: event.previousState,
            newState: event.newState,
            bindingType: event.bindingType,
            error: event.lastError,
            baseline: isBaseline,
            cycleDuration: cycleDuration
        });

        // Cap event log to prevent OOM (Fix 3)
        if (eventLog.length > MAX_EVENT_LOG_SIZE) {
            eventLog.splice(0, eventLog.length - MAX_EVENT_LOG_SIZE);
            eventLogCapped = true;
            // Force full re-render since indices shifted
            lastRenderedSortMode = 'force-rerender';
            renderedEventCount = 0;
            if (eventLogContainer) eventLogContainer.innerHTML = '';
        }

        // Each event is a tick on the waterfall
        entry.state = event.newState;
        entry.ticks.push({
            ms: event.relativeMs,
            state: event.newState,
            baseline: isBaseline,
            error: event.lastError,
            previousState: event.previousState
        });

        // Debounced view chip discovery (Fix 6) - collect names, render once per frame
        if (pageViewOptions.length === 0) {
            var viewName = extractViewName(event.componentPath);
            if (viewName && !discoveredViewNames.has(viewName)) {
                discoveredViewNames.add(viewName);
                viewChipsDirty = true;
            }
        }
    }

    function shortLabel(componentPath, propertyPath) {
        // Parse componentPath like "CascadeTest@D/root/StatusLabel" or "CascadeEmbed@D$0:2/root/Label"
        var viewPart = componentPath.split('/')[0]; // "CascadeTest@D" or "CascadeEmbed@D$0:2"
        var viewName = viewPart.split('@')[0]; // "CascadeTest" or "CascadeEmbed"

        // For embedded views, append instance number
        var instanceMatch = viewPart.match(/\$\d+:(\d+)/);
        if (instanceMatch) {
            viewName = viewName + '#' + instanceMatch[1];
        }

        // Get component name (last segment of path)
        var parts = componentPath.split('/');
        var componentName = parts[parts.length - 1] || 'root';

        return viewName + ' / ' + componentName + '.' + propertyPath;
    }

    // ============================================================================
    // ZOOM HELPERS
    // ============================================================================

    function getEffectiveRange() {
        var fullDuration = Math.max(totalDurationMs, 100);
        if (zoomStartMs !== null && zoomEndMs !== null) {
            var duration = zoomEndMs - zoomStartMs;
            return { startMs: zoomStartMs, endMs: zoomEndMs, duration: duration };
        }
        return { startMs: 0, endMs: fullDuration, duration: fullDuration };
    }

    function resetZoom() {
        zoomStartMs = null;
        zoomEndMs = null;
        waterfallDirty = true;
        if (resetZoomBtn) resetZoomBtn.style.display = 'none';
        requestRender();
    }

    // ============================================================================
    // RENDERING
    // ============================================================================

    // Render throttling — during recording, cap renders to keep UI responsive
    var RENDER_THROTTLE_MS = 300;
    var lastRenderTime = 0;
    var renderThrottleTimer = null;

    function requestRender() {
        if (pendingRender) return;

        if (profilerState === 'recording') {
            // During recording, throttle renders so the event loop stays responsive
            // (otherwise click events like Stop can't fire)
            var now = Date.now();
            var elapsed = now - lastRenderTime;
            if (elapsed >= RENDER_THROTTLE_MS) {
                pendingRender = true;
                requestAnimationFrame(render);
            } else if (!renderThrottleTimer) {
                renderThrottleTimer = setTimeout(function () {
                    renderThrottleTimer = null;
                    pendingRender = true;
                    requestAnimationFrame(render);
                }, RENDER_THROTTLE_MS - elapsed);
            }
        } else {
            pendingRender = true;
            requestAnimationFrame(render);
        }
    }

    function render() {
        pendingRender = false;
        lastRenderTime = Date.now();
        renderCounters();
        renderWaterfall();
        renderEventLog();
        renderFooter();

        // Batch view chip rendering (Fix 6)
        if (viewChipsDirty) {
            renderViewFilterChips();
            viewChipsDirty = false;
        }
    }

    function renderCounters() {
        // Already updated in real-time via updateCounters
    }

    function updateCounters(total, pending, resolved, errors) {
        if (counterTotal) counterTotal.textContent = String(total);
        if (counterPending) counterPending.textContent = String(pending);
        if (counterResolved) counterResolved.textContent = String(resolved);
        if (counterErrors) counterErrors.textContent = String(errors);
    }

    function updateStatus(type, text) {
        if (statusBadge) {
            statusBadge.className = 'recording-status ' + type;
            statusBadge.textContent = text;
        }
    }

    function bindingTypeTag(bindingType) {
        if (!bindingType) return '';
        var abbrev = '';
        var typeClass = '';
        var bt = bindingType.toLowerCase();
        if (bt.indexOf('property') >= 0) {
            abbrev = 'PRO';
            typeClass = 'type-property';
        } else if (bt.indexOf('tag') >= 0) {
            abbrev = 'TAG';
            typeClass = 'type-tag';
        } else if (bt.indexOf('expr') >= 0) {
            abbrev = 'EXP';
            typeClass = 'type-expr';
        } else if (bt.indexOf('query') >= 0) {
            abbrev = 'QRY';
            typeClass = 'type-query';
        } else {
            abbrev = bindingType.substring(0, 3).toUpperCase();
            typeClass = 'type-property';
        }
        return '<span class="binding-type-tag ' + typeClass + '">' + abbrev + '</span>';
    }

    function buildDisplayList() {
        var allEntries = Array.from(waterfallEntries.values());
        var entries = allEntries.filter(function (e) {
            return matchesViewFilter(e.componentPath);
        });

        // Sort using pre-computed sort keys
        entries.sort(function (a, b) {
            var ka = a.sortKey || waterfallSortKey(a);
            var kb = b.sortKey || waterfallSortKey(b);
            if (ka < kb) return -1;
            if (ka > kb) return 1;
            return 0;
        });

        if (!groupingEnabled) {
            displayList = [];
            for (var i = 0; i < entries.length; i++) {
                displayList.push({ type: 'entry', entry: entries[i] });
            }
            return entries.length;
        }

        // Grouping mode: group consecutive entries by componentPath
        displayList = [];
        var currentGroupKey = null;
        var currentGroupEntries = [];

        function flushGroup() {
            if (currentGroupKey === null || currentGroupEntries.length === 0) return;

            // Compute group aggregate stats
            var worstState = 'good';
            var maxDurationMs = 0;
            var stateOrder = { error: 4, bad: 4, pending: 3, stale: 2, good: 1, resolved: 1, unknown: 0 };
            var worstOrder = 0;

            for (var g = 0; g < currentGroupEntries.length; g++) {
                var ge = currentGroupEntries[g];
                var order = stateOrder[ge.state] || 0;
                if (order > worstOrder) {
                    worstOrder = order;
                    worstState = ge.state;
                }
                // Compute max duration from ticks
                var ticks = ge.ticks;
                if (ticks.length >= 2) {
                    var dur = ticks[ticks.length - 1].ms - ticks[0].ms;
                    if (dur > maxDurationMs) maxDurationMs = dur;
                }
            }

            // Extract label: "ViewName / ComponentName"
            var firstEntry = currentGroupEntries[0];
            var pathParts = firstEntry.componentPath.split('/');
            var viewPart = pathParts[0].split('@')[0];
            var componentName = pathParts[pathParts.length - 1] || 'root';
            var groupLabel = viewPart + ' / ' + componentName;

            var expanded = !collapsedGroups.has(currentGroupKey);

            displayList.push({
                type: 'group-header',
                groupKey: currentGroupKey,
                label: groupLabel,
                bindingCount: currentGroupEntries.length,
                worstState: worstState,
                maxDurationMs: maxDurationMs,
                expanded: expanded
            });

            if (expanded) {
                for (var h = 0; h < currentGroupEntries.length; h++) {
                    displayList.push({ type: 'entry', entry: currentGroupEntries[h] });
                }
            }
        }

        for (var j = 0; j < entries.length; j++) {
            var entry = entries[j];
            // Group key = componentPath without propertyPath (everything before the last segment matters)
            var groupKey = entry.componentPath;

            if (groupKey !== currentGroupKey) {
                flushGroup();
                currentGroupKey = groupKey;
                currentGroupEntries = [entry];
            } else {
                currentGroupEntries.push(entry);
            }
        }
        flushGroup();

        return entries.length;
    }

    function createWaterfallRow(entry, range) {
        var row = document.createElement('div');
        row.className = 'waterfall-row';
        row.setAttribute('data-key', entry.key);
        row.setAttribute('data-component-path', entry.componentPath);

        // Re-apply selection
        if (selectedBindingKey === entry.key) {
            row.classList.add('selected');
        }

        // Label with binding type tag
        var label = document.createElement('div');
        label.className = 'waterfall-label';
        label.innerHTML = bindingTypeTag(entry.bindingType) + escapeHtml(entry.label);
        label.title = entry.componentPath + ' : ' + entry.propertyPath + ' (' + entry.bindingType + ')';
        row.appendChild(label);

        // Timeline
        var timeline = document.createElement('div');
        timeline.className = 'waterfall-timeline';

        var ticks = entry.ticks;
        // Compute average cycle time for proportional bar width
        var nonBaselineTicks = ticks.filter(function (t) {
            return !t.baseline;
        });
        var avgCycleMs = 0;
        if (nonBaselineTicks.length >= 2) {
            avgCycleMs =
                (nonBaselineTicks[nonBaselineTicks.length - 1].ms - nonBaselineTicks[0].ms) /
                (nonBaselineTicks.length - 1);
        } else if (nonBaselineTicks.length === 1 && ticks.length >= 2) {
            avgCycleMs = nonBaselineTicks[0].ms - ticks[0].ms;
        }
        // Bar width = 30% of average cycle (shows execution, leaves 70% dead space)
        var barWidthMs = Math.max(avgCycleMs * 0.3, range.duration * 0.01);
        var barWidthPct = (barWidthMs / range.duration) * 100;

        for (var ti = 0; ti < ticks.length; ti++) {
            var tick = ticks[ti];
            var tickLeftMs = tick.ms - range.startMs;
            var tickLeftPct = (tickLeftMs / range.duration) * 100;

            // Skip ticks entirely outside zoom range
            if (tick.baseline) {
                if (tickLeftPct < -5 || tickLeftPct > 105) continue;

                var marker = document.createElement('div');
                marker.className = 'waterfall-tick state-' + tick.state + ' baseline-tick';
                marker.style.left = Math.max(tickLeftPct, 0) + '%';
                // Data attributes for tooltip
                marker.setAttribute('data-label', entry.label);
                marker.setAttribute('data-state', tick.state);
                marker.setAttribute('data-binding-type', entry.bindingType);
                marker.setAttribute('data-completed-ms', String(tick.ms));
                marker.setAttribute('data-baseline', 'true');
                if (tick.error) {
                    marker.setAttribute('data-error', tick.error);
                }
                timeline.appendChild(marker);
            } else {
                var prevMs = ti > 0 ? ticks[ti - 1].ms : 0;
                var barLeft = Math.max(tickLeftPct - barWidthPct, 0);
                var barRight = tickLeftPct;

                // Skip bars entirely outside zoom range
                if (barRight < -5 || barLeft > 105) continue;

                var bar = document.createElement('div');
                bar.className = 'waterfall-bar state-' + tick.state;
                bar.style.left = barLeft + '%';
                bar.style.width = barWidthPct + '%';

                // Data attributes for tooltip
                bar.setAttribute('data-label', entry.label);
                var prevTickIsBaseline = ti > 0 && ticks[ti - 1].baseline;
                var barStartMs = prevTickIsBaseline ? Math.max(tick.ms - barWidthMs, 0) : prevMs;
                bar.setAttribute('data-start-ms', String(Math.round(barStartMs)));
                bar.setAttribute('data-end-ms', String(tick.ms));
                bar.setAttribute('data-state', tick.state);
                bar.setAttribute('data-binding-type', entry.bindingType);
                bar.setAttribute('data-baseline', 'false');
                if (tick.error) {
                    bar.setAttribute('data-error', tick.error);
                }

                timeline.appendChild(bar);
            }
        }

        row.appendChild(timeline);
        return row;
    }

    function renderWaterfall() {
        if (!waterfallRows) return;

        // Rebuild display list when data changed
        if (waterfallDirty) {
            waterfallDirty = false;
            var bindingCount = buildDisplayList();

            if (bindingCount === 0 && displayList.length === 0) {
                if (waterfallEmpty) waterfallEmpty.style.display = 'flex';
                waterfallRows.style.display = 'none';
                if (waterfallTimeHeader) waterfallTimeHeader.style.display = 'none';
                if (waterfallCount) waterfallCount.textContent = '0 bindings';
                return;
            }

            if (waterfallEmpty) waterfallEmpty.style.display = 'none';
            waterfallRows.style.display = 'block';
            if (waterfallTimeHeader) waterfallTimeHeader.style.display = 'flex';
            if (groupToggleBtn) groupToggleBtn.style.display = 'inline-block';

            var filterNote = activeViewFilter ? ' (filtered)' : '';
            if (groupingEnabled) {
                var groupCount = 0;
                for (var gc = 0; gc < displayList.length; gc++) {
                    if (displayList[gc].type === 'group-header') groupCount++;
                }
                if (waterfallCount)
                    waterfallCount.textContent =
                        bindingCount + ' bindings in ' + groupCount + ' components' + filterNote;
            } else {
                if (waterfallCount) waterfallCount.textContent = bindingCount + ' bindings' + filterNote;
            }

            // Reset visible range to force re-render
            lastVisibleFirst = -1;
            lastVisibleLast = -1;
        }

        if (displayList.length === 0) return;

        // Determine time scale using zoom range
        var range = getEffectiveRange();
        currentEffectiveDuration = range.duration;

        // Update time markers
        renderTimeMarkers(range);

        // Render visible rows (virtual scrolling)
        updateVisibleRows();
    }

    function updateVisibleRows() {
        if (!waterfallContainer || !waterfallRows || displayList.length === 0) return;

        // Account for sticky time header height
        var timeHeaderHeight = waterfallTimeHeader ? waterfallTimeHeader.offsetHeight : 0;
        var scrollOffset = waterfallContainer.scrollTop - timeHeaderHeight;
        var viewportHeight = waterfallContainer.clientHeight - timeHeaderHeight;

        var firstVisible = Math.floor(scrollOffset / ROW_HEIGHT) - OVERSCAN;
        var lastVisible = Math.ceil((scrollOffset + viewportHeight) / ROW_HEIGHT) + OVERSCAN;

        firstVisible = Math.max(0, firstVisible);
        lastVisible = Math.min(displayList.length - 1, lastVisible);

        // Skip if range unchanged
        if (firstVisible === lastVisibleFirst && lastVisible === lastVisibleLast) return;
        lastVisibleFirst = firstVisible;
        lastVisibleLast = lastVisible;

        renderVisibleRows(firstVisible, lastVisible);
    }

    function renderVisibleRows(first, last) {
        if (!waterfallRows) return;

        var total = displayList.length;
        var topPx = first * ROW_HEIGHT;
        var bottomPx = Math.max(0, (total - last - 1) * ROW_HEIGHT);

        waterfallRows.style.paddingTop = topPx + 'px';
        waterfallRows.style.paddingBottom = bottomPx + 'px';

        var range = getEffectiveRange();
        var fragment = document.createDocumentFragment();

        for (var i = first; i <= last; i++) {
            var item = displayList[i];
            if (item.type === 'entry') {
                fragment.appendChild(createWaterfallRow(item.entry, range));
            } else if (item.type === 'group-header') {
                fragment.appendChild(createGroupHeaderRow(item));
            }
        }

        waterfallRows.innerHTML = '';
        waterfallRows.appendChild(fragment);
    }

    function createGroupHeaderRow(item) {
        var row = document.createElement('div');
        row.className = 'waterfall-row waterfall-group-header';
        row.setAttribute('data-group-key', item.groupKey);

        var chevron = document.createElement('span');
        chevron.className = 'group-chevron';
        chevron.textContent = item.expanded ? '\u25BE' : '\u25B8';
        row.appendChild(chevron);

        var dot = document.createElement('span');
        dot.className = 'group-state-dot state-' + item.worstState;
        row.appendChild(dot);

        var label = document.createElement('span');
        label.className = 'group-label';
        label.textContent = item.label;
        row.appendChild(label);

        var badge = document.createElement('span');
        badge.className = 'group-badge';
        badge.textContent = String(item.bindingCount);
        row.appendChild(badge);

        if (item.maxDurationMs > 0) {
            var dur = document.createElement('span');
            dur.className = 'group-duration';
            dur.textContent = formatDuration(item.maxDurationMs);
            row.appendChild(dur);
        }

        return row;
    }

    function renderTimeMarkers(range) {
        if (!waterfallTimeHeader) return;

        const markers = [0, 0.25, 0.5, 0.75, 1.0];
        waterfallTimeHeader.innerHTML = '';

        for (const pct of markers) {
            const marker = document.createElement('div');
            marker.className = 'waterfall-time-marker';
            const ms = Math.round(range.startMs + range.duration * pct);
            marker.textContent = formatDuration(ms);
            waterfallTimeHeader.appendChild(marker);
        }
    }

    function renderEventLog() {
        if (!eventLogContainer) return;

        // Apply view filter to event log
        var filteredEvents = activeViewFilter
            ? eventLog.filter(function (evt) {
                  var entry = waterfallEntries.get(evt.key);
                  return entry ? matchesViewFilter(entry.componentPath) : true;
              })
            : eventLog;

        if (filteredEvents.length === 0) {
            if (eventLogEmpty) eventLogEmpty.style.display = 'flex';
            if (eventLogCount) eventLogCount.textContent = '0 events';
            renderedEventCount = 0;
            return;
        }

        if (eventLogEmpty) eventLogEmpty.style.display = 'none';
        var filterNote = activeViewFilter ? ' (filtered)' : '';
        var cappedNote = eventLogCapped ? ' (capped)' : '';
        if (eventLogCount) eventLogCount.textContent = filteredEvents.length + ' events' + filterNote + cappedNote;

        // Only force full re-render when sort mode or filter actually changes (Fix 5)
        var needsFullRender = lastRenderedSortMode !== eventLogSortBy || lastRenderedViewFilter !== activeViewFilter;
        lastRenderedSortMode = eventLogSortBy;
        lastRenderedViewFilter = activeViewFilter;

        if (eventLogSortBy === 'duration' || needsFullRender) {
            // Full re-render for sorted/filtered view
            var sortedEvents = activeViewFilter ? filteredEvents : getSortedEventLog();
            if (eventLogSortBy === 'duration' && activeViewFilter) {
                sortedEvents = filteredEvents.slice().sort(function (a, b) {
                    return b.cycleDuration - a.cycleDuration;
                });
            }
            eventLogContainer.innerHTML = '';
            var fragment = document.createDocumentFragment();
            for (var i = 0; i < sortedEvents.length; i++) {
                fragment.appendChild(createEventLogEntry(sortedEvents[i]));
            }
            eventLogContainer.appendChild(fragment);
            renderedEventCount = sortedEvents.length;
        } else {
            // Append-only for chronological (performance optimization)
            // Use tracked count instead of DOM query (Fix 5)
            if (renderedEventCount >= filteredEvents.length) return;

            var appendFragment = document.createDocumentFragment();
            for (var j = renderedEventCount; j < filteredEvents.length; j++) {
                appendFragment.appendChild(createEventLogEntry(filteredEvents[j]));
            }
            eventLogContainer.appendChild(appendFragment);
            renderedEventCount = filteredEvents.length;
        }

        // Auto-scroll
        if (autoScroll) {
            eventLogContainer.scrollTop = eventLogContainer.scrollHeight;
        }
    }

    function createEventLogEntry(evt) {
        var entry = document.createElement('div');
        entry.className = 'event-log-entry';
        entry.setAttribute('data-key', evt.key);

        var prevLabel = evt.previousState || 'initial';
        if (evt.baseline) {
            entry.className = 'event-log-entry baseline';
            entry.setAttribute('data-key', evt.key);
        }

        // Apply highlight if this binding is selected
        if (selectedBindingKey && evt.key === selectedBindingKey) {
            entry.classList.add('highlighted');
        }

        var cyclePart = '';
        if (!evt.baseline && evt.cycleDuration > 0) {
            cyclePart = '<span class="event-cycle-duration">' + formatDuration(evt.cycleDuration) + '</span>';
        }

        entry.innerHTML =
            '<span class="event-time">+' +
            formatDuration(evt.relativeMs) +
            '</span>' +
            (evt.baseline ? '<span class="event-baseline-tag">baseline</span>' : '') +
            '<span class="event-label">' +
            escapeHtml(evt.label) +
            '</span>' +
            '<span class="event-transition">' +
            '<span class="event-state state-' +
            prevLabel +
            '">' +
            prevLabel +
            '</span>' +
            '<span class="event-arrow">&rarr;</span>' +
            '<span class="event-state state-' +
            evt.newState +
            '">' +
            evt.newState +
            '</span>' +
            '</span>' +
            cyclePart +
            '<span class="event-binding-type">' +
            escapeHtml(evt.bindingType) +
            '</span>';

        return entry;
    }

    function renderFooter() {
        if (durationDisplay) {
            durationDisplay.textContent = formatDuration(totalDurationMs);
        }
        if (eventCountDisplay) {
            var cappedNote = eventLogCapped ? ' (capped)' : '';
            eventCountDisplay.textContent = eventLog.length + ' events' + cappedNote;
        }
    }

    // ============================================================================
    // TOOLTIP
    // ============================================================================

    if (waterfallRows) {
        waterfallRows.addEventListener('mouseover', function (e) {
            var target = /** @type {HTMLElement} */ e.target;
            var bar = target.closest('.waterfall-bar, .waterfall-tick');
            if (!bar || !waterfallTooltip) return;

            var label = bar.getAttribute('data-label') || '';
            var isBaseline = bar.getAttribute('data-baseline') === 'true';
            var state = bar.getAttribute('data-state') || '';
            var bindingType = bar.getAttribute('data-binding-type') || '';

            var html = '<div class="tooltip-label">' + escapeHtml(label) + '</div>';

            if (isBaseline) {
                var completedMs = bar.getAttribute('data-completed-ms') || '';
                var baselineError = bar.getAttribute('data-error');
                html +=
                    '<div class="tooltip-row"><span class="tooltip-key">Type</span><span class="tooltip-value">Baseline snapshot</span></div>';
                html +=
                    '<div class="tooltip-row"><span class="tooltip-key">State</span><span class="tooltip-value">' +
                    escapeHtml(state) +
                    '</span></div>';
                html +=
                    '<div class="tooltip-row"><span class="tooltip-key">Time</span><span class="tooltip-value">' +
                    formatDuration(Number(completedMs)) +
                    '</span></div>';
                if (baselineError) {
                    html += '<div class="tooltip-error">' + escapeHtml(baselineError) + '</div>';
                }
            } else {
                var error = bar.getAttribute('data-error');
                var endMs = Number(bar.getAttribute('data-end-ms') || '0');
                var startMs = Number(bar.getAttribute('data-start-ms') || '0');
                var durationMs = endMs - startMs;

                html +=
                    '<div class="tooltip-row"><span class="tooltip-key">Start</span><span class="tooltip-value">' +
                    formatDuration(startMs) +
                    '</span></div>';
                html +=
                    '<div class="tooltip-row"><span class="tooltip-key">End</span><span class="tooltip-value">' +
                    formatDuration(endMs) +
                    '</span></div>';
                html +=
                    '<div class="tooltip-row"><span class="tooltip-key">Duration</span><span class="tooltip-value">' +
                    formatDuration(durationMs) +
                    '</span></div>';
                html +=
                    '<div class="tooltip-row"><span class="tooltip-key">Binding</span><span class="tooltip-value">' +
                    escapeHtml(bindingType) +
                    '</span></div>';

                if (error) {
                    html += '<div class="tooltip-error">' + escapeHtml(error) + '</div>';
                }
            }

            waterfallTooltip.innerHTML = html;
            waterfallTooltip.style.display = 'block';

            // Position above bar, flip below if near top
            var rect = bar.getBoundingClientRect();
            var tooltipRect = waterfallTooltip.getBoundingClientRect();
            var top = rect.top - tooltipRect.height - 6;
            if (top < 0) {
                top = rect.bottom + 6;
            }
            var left = rect.left + rect.width / 2 - tooltipRect.width / 2;
            left = Math.max(4, Math.min(left, window.innerWidth - tooltipRect.width - 4));

            waterfallTooltip.style.top = top + 'px';
            waterfallTooltip.style.left = left + 'px';
        });

        waterfallRows.addEventListener('mouseout', function (e) {
            var target = /** @type {HTMLElement} */ e.target;
            var bar = target.closest('.waterfall-bar, .waterfall-tick');
            if (bar && waterfallTooltip) {
                waterfallTooltip.style.display = 'none';
            }
        });
    }

    // ============================================================================
    // ROW SELECTION (click row → highlight events in log)
    // ============================================================================

    if (waterfallRows) {
        waterfallRows.addEventListener('click', function (e) {
            var target = /** @type {HTMLElement} */ e.target;

            // Handle group header expand/collapse
            var groupRow = target.closest('.waterfall-group-header');
            if (groupRow) {
                var groupKey = groupRow.getAttribute('data-group-key');
                if (groupKey) {
                    if (collapsedGroups.has(groupKey)) {
                        collapsedGroups.delete(groupKey);
                    } else {
                        collapsedGroups.add(groupKey);
                    }
                    waterfallDirty = true;
                    requestRender();
                }
                return;
            }

            var row = target.closest('.waterfall-row');
            if (!row) return;

            var key = row.getAttribute('data-key');
            if (!key) return;

            // Toggle selection
            var prevSelected = waterfallRows.querySelector('.waterfall-row.selected');
            if (prevSelected) prevSelected.classList.remove('selected');

            if (selectedBindingKey === key) {
                selectedBindingKey = null;
            } else {
                selectedBindingKey = key;
                row.classList.add('selected');
            }

            // Update event log highlighting
            if (eventLogContainer) {
                var logEntries = eventLogContainer.querySelectorAll('.event-log-entry');
                var firstMatch = null;
                for (var j = 0; j < logEntries.length; j++) {
                    var isMatch = logEntries[j].getAttribute('data-key') === selectedBindingKey;
                    logEntries[j].classList.toggle('highlighted', isMatch);
                    if (isMatch && !firstMatch) {
                        firstMatch = logEntries[j];
                    }
                }
                // Scroll to first match
                if (firstMatch) {
                    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        });
    }

    // ============================================================================
    // TIME CURSOR
    // ============================================================================

    if (waterfallContainer && timeCursor) {
        waterfallContainer.addEventListener('mousemove', function (e) {
            if (isDragging) return; // Don't show cursor during zoom drag

            var containerRect = waterfallContainer.getBoundingClientRect();
            var relativeX = e.clientX - containerRect.left - LABEL_COLUMN_WIDTH;
            var timelineWidth = containerRect.width - LABEL_COLUMN_WIDTH - TIMELINE_RIGHT_MARGIN;

            if (relativeX < 0 || relativeX > timelineWidth) {
                timeCursor.style.display = 'none';
                return;
            }

            var range = getEffectiveRange();
            var cursorMs = range.startMs + (relativeX / timelineWidth) * range.duration;

            timeCursor.style.display = 'block';
            timeCursor.style.left = LABEL_COLUMN_WIDTH + relativeX + 'px';

            var cursorLabel = timeCursor.querySelector('.time-cursor-label');
            if (cursorLabel) {
                cursorLabel.textContent = formatDuration(Math.round(cursorMs));
            }
        });

        waterfallContainer.addEventListener('mouseleave', function () {
            timeCursor.style.display = 'none';
        });
    }

    // ============================================================================
    // VIRTUAL SCROLL HANDLER
    // ============================================================================

    if (waterfallContainer) {
        var scrollRafPending = false;
        waterfallContainer.addEventListener('scroll', function () {
            if (!scrollRafPending) {
                scrollRafPending = true;
                requestAnimationFrame(function () {
                    scrollRafPending = false;
                    updateVisibleRows();
                });
            }
        });
    }

    // ============================================================================
    // CLICK-AND-DRAG ZOOM
    // ============================================================================

    if (waterfallContainer && zoomOverlay) {
        waterfallContainer.addEventListener('mousedown', function (e) {
            // Only left button, only in timeline area
            if (e.button !== 0) return;
            var containerRect = waterfallContainer.getBoundingClientRect();
            var relativeX = e.clientX - containerRect.left - LABEL_COLUMN_WIDTH;
            var timelineWidth = containerRect.width - LABEL_COLUMN_WIDTH - TIMELINE_RIGHT_MARGIN;

            if (relativeX < 0 || relativeX > timelineWidth) return;

            var range = getEffectiveRange();
            isDragging = true;
            dragStartX = e.clientX;
            dragStartMs = range.startMs + (relativeX / timelineWidth) * range.duration;

            // Show overlay at start position
            zoomOverlay.style.display = 'block';
            zoomOverlay.style.left = LABEL_COLUMN_WIDTH + relativeX + 'px';
            zoomOverlay.style.width = '0px';

            // Hide cursor during drag
            if (timeCursor) timeCursor.style.display = 'none';

            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            if (!waterfallContainer || !zoomOverlay) return;

            var containerRect = waterfallContainer.getBoundingClientRect();
            var relativeX = e.clientX - containerRect.left - LABEL_COLUMN_WIDTH;
            var timelineWidth = containerRect.width - LABEL_COLUMN_WIDTH - TIMELINE_RIGHT_MARGIN;
            relativeX = Math.max(0, Math.min(relativeX, timelineWidth));

            var startRelativeX = dragStartX - containerRect.left - LABEL_COLUMN_WIDTH;
            startRelativeX = Math.max(0, Math.min(startRelativeX, timelineWidth));

            var leftX = Math.min(startRelativeX, relativeX);
            var widthX = Math.abs(relativeX - startRelativeX);

            zoomOverlay.style.left = LABEL_COLUMN_WIDTH + leftX + 'px';
            zoomOverlay.style.width = widthX + 'px';

            // Update selection label
            var range = getEffectiveRange();
            var ms1 = range.startMs + (leftX / timelineWidth) * range.duration;
            var ms2 = range.startMs + ((leftX + widthX) / timelineWidth) * range.duration;
            var selectionLabel = zoomOverlay.querySelector('.zoom-selection-label');
            if (selectionLabel) {
                selectionLabel.textContent = formatDuration(Math.round(ms1)) + ' - ' + formatDuration(Math.round(ms2));
            }
        });

        document.addEventListener('mouseup', function (e) {
            if (!isDragging) return;
            isDragging = false;

            if (zoomOverlay) zoomOverlay.style.display = 'none';
            if (!waterfallContainer) return;

            var containerRect = waterfallContainer.getBoundingClientRect();
            var dragDistance = Math.abs(e.clientX - dragStartX);

            if (dragDistance > 5) {
                // Zoom in
                var timelineWidth = containerRect.width - LABEL_COLUMN_WIDTH - TIMELINE_RIGHT_MARGIN;
                var range = getEffectiveRange();

                var startRelativeX = dragStartX - containerRect.left - LABEL_COLUMN_WIDTH;
                var endRelativeX = e.clientX - containerRect.left - LABEL_COLUMN_WIDTH;
                startRelativeX = Math.max(0, Math.min(startRelativeX, timelineWidth));
                endRelativeX = Math.max(0, Math.min(endRelativeX, timelineWidth));

                var ms1 = range.startMs + (Math.min(startRelativeX, endRelativeX) / timelineWidth) * range.duration;
                var ms2 = range.startMs + (Math.max(startRelativeX, endRelativeX) / timelineWidth) * range.duration;

                // Minimum zoom range: 10ms
                if (ms2 - ms1 >= 10) {
                    zoomStartMs = ms1;
                    zoomEndMs = ms2;
                    waterfallDirty = true;
                    if (resetZoomBtn) resetZoomBtn.style.display = 'inline-block';
                    requestRender();
                }
            }
        });

        // Double-click resets zoom
        waterfallContainer.addEventListener('dblclick', function () {
            if (zoomStartMs !== null) {
                resetZoom();
            }
        });
    }

    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', function () {
            resetZoom();
        });
    }

    // ============================================================================
    // CONTEXT MENU (right-click → Open in Designer)
    // ============================================================================

    if (waterfallRows && contextMenu) {
        waterfallRows.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            var target = /** @type {HTMLElement} */ e.target;
            var row = target.closest('.waterfall-row');
            if (!row) return;

            var componentPath = row.getAttribute('data-component-path');
            if (!componentPath) return;

            // Extract view name: "CascadeTest@D/root/Label" → "CascadeTest"
            var viewPart = componentPath.split('/')[0];
            var viewName = viewPart.split('@')[0];

            contextMenu.innerHTML =
                '<div class="context-menu-item" data-action="openInDesigner" data-view="' +
                escapeHtml(viewName) +
                '">Open "' +
                escapeHtml(viewName) +
                '" in Designer</div>';
            contextMenu.style.display = 'block';
            contextMenu.style.left = e.clientX + 'px';
            contextMenu.style.top = e.clientY + 'px';

            // Clamp to viewport
            var menuRect = contextMenu.getBoundingClientRect();
            if (menuRect.right > window.innerWidth) {
                contextMenu.style.left = window.innerWidth - menuRect.width - 4 + 'px';
            }
            if (menuRect.bottom > window.innerHeight) {
                contextMenu.style.top = window.innerHeight - menuRect.height - 4 + 'px';
            }
        });

        contextMenu.addEventListener('click', function (e) {
            var target = /** @type {HTMLElement} */ e.target;
            var item = target.closest('.context-menu-item');
            if (!item) return;

            var action = item.getAttribute('data-action');
            if (action === 'openInDesigner') {
                var viewName = item.getAttribute('data-view');
                if (viewName) {
                    vscode.postMessage({
                        command: 'openInDesigner',
                        resourceType: 'perspective-view',
                        resourcePath: viewName
                    });
                }
            }
            contextMenu.style.display = 'none';
        });

        // Hide context menu on click elsewhere or Escape
        document.addEventListener('click', function () {
            if (contextMenu) contextMenu.style.display = 'none';
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && contextMenu) {
                contextMenu.style.display = 'none';
            }
        });
    }

    // ============================================================================
    // BUTTON HANDLERS
    // ============================================================================

    if (startBtn) {
        startBtn.addEventListener('click', function () {
            // Validate selections
            var sessionId = sessionSelect ? sessionSelect.value : '';
            var pageId = pageSelect ? pageSelect.value : '';
            var pollInterval = pollRateSelect ? parseInt(pollRateSelect.value, 10) : 50;

            if (!sessionId || !pageId) {
                updateStatus('idle', 'Select scope first');
                return;
            }

            vscode.postMessage({
                command: 'startRecording',
                sessionId: sessionId,
                pageId: pageId,
                pollIntervalMs: pollInterval
            });
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', function () {
            vscode.postMessage({ command: 'stopRecording' });
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', function () {
            var data = {
                events: eventLog,
                waterfall: Array.from(waterfallEntries.values()).map(function (e) {
                    return {
                        key: e.key,
                        label: e.label,
                        componentPath: e.componentPath,
                        propertyPath: e.propertyPath,
                        bindingType: e.bindingType,
                        ticks: e.ticks
                    };
                }),
                durationMs: totalDurationMs
            };
            vscode.postMessage({ command: 'exportData', data: data });
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            vscode.postMessage({ command: 'refreshRecording' });
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', function () {
            vscode.postMessage({ command: 'importSnapshot' });
        });
    }

    if (sortToggleBtn) {
        sortToggleBtn.addEventListener('click', function () {
            eventLogSortBy = eventLogSortBy === 'time' ? 'duration' : 'time';
            sortToggleBtn.textContent = eventLogSortBy === 'time' ? 'Sort: Time' : 'Sort: Duration';
            requestRender();
        });
    }

    if (groupToggleBtn) {
        groupToggleBtn.addEventListener('click', function () {
            groupingEnabled = !groupingEnabled;
            groupToggleBtn.textContent = groupingEnabled ? 'Ungroup' : 'Group';
            collapsedGroups.clear();
            waterfallDirty = true;
            requestRender();
        });
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', function () {
            var sortedEvents = getSortedEventLog();
            var lines = ['Time (ms),Label,Previous State,New State,Binding Type,Duration (ms),Baseline,Error'];
            for (var i = 0; i < sortedEvents.length; i++) {
                var evt = sortedEvents[i];
                lines.push(
                    evt.relativeMs +
                        ',' +
                        '"' +
                        (evt.label || '').replace(/"/g, '""') +
                        '",' +
                        '"' +
                        (evt.previousState || 'initial') +
                        '",' +
                        '"' +
                        (evt.newState || '') +
                        '",' +
                        '"' +
                        (evt.bindingType || '') +
                        '",' +
                        evt.cycleDuration +
                        ',' +
                        (evt.baseline ? 'true' : 'false') +
                        ',' +
                        '"' +
                        (evt.error || '').replace(/"/g, '""') +
                        '"'
                );
            }
            vscode.postMessage({ command: 'exportCsv', csv: lines.join('\n') });
        });
    }

    // ============================================================================
    // RELOAD & RECORD BUTTON HANDLERS
    // ============================================================================

    if (reloadRecordBtn) {
        reloadRecordBtn.addEventListener('click', function () {
            var sessionId = sessionSelect ? sessionSelect.value : '';
            var pageId = pageSelect ? pageSelect.value : '';
            var pollInterval = pollRateSelect ? parseInt(pollRateSelect.value, 10) : 50;

            if (!sessionId || !pageId) {
                updateStatus('idle', 'Select scope first');
                return;
            }

            // Get viewPath from the page's primary view (first non-embedded view)
            var viewPath = '';
            for (var i = 0; i < pageViewOptions.length; i++) {
                if (pageViewOptions[i].viewPath) {
                    viewPath = pageViewOptions[i].viewPath;
                    break;
                }
            }
            // Fallback: get from page select data attribute (works without prior recording)
            if (!viewPath && pageSelect) {
                var selectedOption = pageSelect.options[pageSelect.selectedIndex];
                if (selectedOption) {
                    viewPath = selectedOption.getAttribute('data-view-path') || '';
                }
            }

            vscode.postMessage({
                command: 'startReloadRecord',
                sessionId: sessionId,
                pageId: pageId,
                viewPath: viewPath,
                pollIntervalMs: pollInterval
            });
        });
    }

    if (cancelReloadBtn) {
        cancelReloadBtn.addEventListener('click', function () {
            vscode.postMessage({ command: 'cancelReloadRecord' });
        });
    }

    // ============================================================================
    // SCOPE DROPDOWNS
    // ============================================================================

    if (sessionSelect) {
        sessionSelect.addEventListener('change', function () {
            // Clear downstream
            if (pageSelect) pageSelect.innerHTML = '';

            vscode.postMessage({
                command: 'requestScopeUpdate',
                level: 'pages',
                sessionId: sessionSelect.value
            });
        });
    }

    if (pageSelect) {
        pageSelect.addEventListener('change', function () {
            vscode.postMessage({
                command: 'requestScopeUpdate',
                level: 'pages',
                sessionId: sessionSelect ? sessionSelect.value : '',
                pageId: pageSelect.value
            });

            // Enable/disable reload button based on page selection
            if (reloadRecordBtn && (profilerState === 'idle' || profilerState === 'complete')) {
                reloadRecordBtn.disabled = !pageSelect.value;
            }
        });
    }

    // ============================================================================
    // VIEW FILTER CHIPS
    // ============================================================================

    function extractViewName(componentPath) {
        var viewPart = componentPath.split('/')[0]; // "CascadeTest@D" or "CascadeEmbed@D$0:2"
        return viewPart.split('@')[0]; // "CascadeTest" or "CascadeEmbed"
    }

    function renderViewFilterChips() {
        if (!viewFilterBar) return;

        // Don't show chips when there's no data to filter
        if (waterfallEntries.size === 0) {
            viewFilterBar.innerHTML = '';
            viewFilterBar.style.display = 'none';
            return;
        }

        viewFilterBar.innerHTML = '';

        // Collect view chips with separate display labels and filter values.
        // activeViewFilter stores the short view name (matching extractViewName output),
        // while the chip displays the full path label for clarity.
        var viewChips = []; // {displayLabel, filterValue}
        var seenFilterValues = [];
        if (pageViewOptions.length > 0) {
            for (var i = 0; i < pageViewOptions.length; i++) {
                var viewPath = pageViewOptions[i].viewPath || '';
                var displayLabel = pageViewOptions[i].label || viewPath || '';
                // Derive short view name from viewPath (last segment) to match extractViewName()
                var pathSegments = viewPath.split('/');
                var filterValue = pathSegments[pathSegments.length - 1] || displayLabel;
                if (filterValue && seenFilterValues.indexOf(filterValue) < 0) {
                    seenFilterValues.push(filterValue);
                    viewChips.push({ displayLabel: displayLabel, filterValue: filterValue });
                }
            }
        } else {
            // Fallback: extract from recorded entries (display and filter are the same)
            var entries = Array.from(waterfallEntries.values());
            for (var j = 0; j < entries.length; j++) {
                var vn = extractViewName(entries[j].componentPath);
                if (vn && seenFilterValues.indexOf(vn) < 0) {
                    seenFilterValues.push(vn);
                    viewChips.push({ displayLabel: vn, filterValue: vn });
                }
            }
        }

        if (viewChips.length <= 1) {
            // Only one or zero views — no need for filter chips
            viewFilterBar.style.display = 'none';
            return;
        }

        viewFilterBar.style.display = 'flex';

        // "All" chip
        var allChip = document.createElement('button');
        allChip.className = 'view-filter-chip' + (activeViewFilter === null ? ' active' : '');
        allChip.textContent = 'All';
        allChip.addEventListener('click', function () {
            activeViewFilter = null;
            waterfallDirty = true;
            renderViewFilterChips();
            requestRender();
        });
        viewFilterBar.appendChild(allChip);

        // Per-view chips
        for (var k = 0; k < viewChips.length; k++) {
            (function (chip) {
                var btn = document.createElement('button');
                btn.className = 'view-filter-chip' + (activeViewFilter === chip.filterValue ? ' active' : '');
                btn.textContent = chip.displayLabel;
                btn.addEventListener('click', function () {
                    activeViewFilter = chip.filterValue;
                    waterfallDirty = true;
                    renderViewFilterChips();
                    requestRender();
                });
                viewFilterBar.appendChild(btn);
            })(viewChips[k]);
        }
    }

    function matchesViewFilter(componentPath) {
        if (activeViewFilter === null) return true;
        var viewName = extractViewName(componentPath);
        return viewName === activeViewFilter;
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    /**
     * Produces a sort key for waterfall entries that groups by view hierarchy:
     * 1. Parent view bindings first (root props, then components by name)
     * 2. Embedded views after, sorted by instance number
     * 3. Within each view, root props first, then components by depth/name
     */
    function waterfallSortKey(entry) {
        var path = entry.componentPath;
        var viewPart = path.split('/')[0]; // "CascadeTest@D" or "CascadeEmbed@D$0:2"

        // Parent views (no $) sort before embedded views
        var isEmbedded = viewPart.indexOf('$') >= 0;

        // Extract instance number for embedded views (for ordering)
        var instanceNum = 0;
        var instMatch = viewPart.match(/\$\d+:(\d+)/);
        if (instMatch) instanceNum = parseInt(instMatch[1], 10);

        // Component depth (segments after view part)
        var segments = path.split('/');
        var depth = segments.length - 1;

        // Component name (last segment)
        var componentName = segments[segments.length - 1] || '';

        // Pad numbers for string sorting
        var depthStr = String(depth).padStart(2, '0');
        var instanceStr = String(instanceNum).padStart(4, '0');

        if (isEmbedded) {
            return '1::' + instanceStr + '::' + depthStr + '::' + componentName + '::' + entry.propertyPath;
        }
        return '0::' + depthStr + '::' + componentName + '::' + entry.propertyPath;
    }

    function formatDuration(ms) {
        if (ms >= 5000) {
            return (ms / 1000).toFixed(2) + 's';
        }
        return ms + 'ms';
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /**
     * @typedef {{ key: string, label: string, componentPath: string, propertyPath: string, bindingType: string, ticks: Array<{ms: number, state: string, baseline: boolean, error: string|null, previousState: string|null}>, firstEventMs: number, state: string, sortKey: string|null }} WaterfallEntry
     * @typedef {{ key: string, relativeMs: number, label: string, previousState: string, newState: string, bindingType: string, error: string|null, baseline: boolean, cycleDuration: number }} RecordingEvent
     */
})();
