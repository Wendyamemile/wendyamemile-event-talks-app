/**
 * BigQuery Pulse - Client Logic & Interactive Tweet Hub
 */

document.addEventListener('DOMContentLoaded', () => {
    // App State
    let allUpdates = [];
    let filteredUpdates = [];
    let currentUpdateForTweet = null;
    let bookmarks = new Set(JSON.parse(localStorage.getItem('bq_bookmarks') || '[]'));
    let activeCategory = 'ALL';
    let activeTag = 'ALL';
    let showOnlyBookmarks = false;
    let activeTemplate = 'standard';

    // DOM Elements
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshBtnText = document.getElementById('refreshBtnText');
    const statusText = document.getElementById('statusText');
    const statTotalCount = document.getElementById('statTotalCount');
    const statLastChecked = document.getElementById('statLastChecked');

    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const categoryPillsContainer = document.getElementById('categoryPills');
    const tagSelect = document.getElementById('tagSelect');
    const sortSelect = document.getElementById('sortSelect');
    const showBookmarksBtn = document.getElementById('showBookmarksBtn');
    const bookmarkCountSpan = document.getElementById('bookmarkCount');

    const activeFiltersBanner = document.getElementById('activeFiltersBanner');
    const filterSummaryText = document.getElementById('filterSummaryText');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');

    const updatesGrid = document.getElementById('updatesGrid');
    const loadingSkeletons = document.getElementById('loadingSkeletons');
    const emptyState = document.getElementById('emptyState');
    const emptyStateResetBtn = document.getElementById('emptyStateResetBtn');

    // Tweet Modal Elements
    const tweetModal = document.getElementById('tweetModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalUpdateCategory = document.getElementById('modalUpdateCategory');
    const modalUpdateDate = document.getElementById('modalUpdateDate');
    const modalUpdateHeadline = document.getElementById('modalUpdateHeadline');
    const tweetTextArea = document.getElementById('tweetTextArea');
    const charCount = document.getElementById('charCount');
    const charProgressFill = document.getElementById('charProgressFill');
    const liveTweetPreviewText = document.getElementById('liveTweetPreviewText');
    const openTwitterBtn = document.getElementById('openTwitterBtn');
    const copyTweetBtn = document.getElementById('copyTweetBtn');
    const templateBtns = document.querySelectorAll('.template-btn');

    // Toast Element
    const toastNotification = document.getElementById('toastNotification');
    const toastMessage = document.getElementById('toastMessage');

    // Initialize App
    init();

    function init() {
        updateBookmarkCountUI();
        fetchReleaseNotes(false);
        setupEventListeners();
    }

    // Fetch Release Notes API
    async function fetchReleaseNotes(forceRefresh = false) {
        setLoadingState(true);
        statusText.textContent = forceRefresh ? "Refreshing live feed..." : "Fetching release notes...";

        try {
            const url = forceRefresh ? '/api/release-notes?force=true' : '/api/release-notes';
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'success' || data.updates) {
                allUpdates = data.updates || [];
                
                // Update UI Stats
                statTotalCount.textContent = allUpdates.length;
                const fetchedDate = new Date(data.last_fetched || Date.now());
                statLastChecked.textContent = fetchedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                statusText.textContent = data.from_cache ? "Live Feed (Cached)" : "Live Feed Synced";

                // Populate Categories & Tags
                renderCategoryPills(data.categories || []);
                renderTagOptions(data.all_tags || []);

                // Apply Filters & Render Cards
                applyFiltersAndRender();
            } else {
                showToast("Failed to parse release notes feed.", "error");
                showEmptyState(data.message || "Unable to fetch release notes feed.");
            }
        } catch (err) {
            console.error("Network or API Error:", err);
            showToast("Connection error while fetching feed.", "error");
            showEmptyState("Could not connect to the backend server.");
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshBtn.classList.add('loading');
            refreshBtnText.textContent = "Updating...";
            loadingSkeletons.classList.remove('hidden');
            updatesGrid.classList.add('hidden');
            emptyState.classList.add('hidden');
        } else {
            refreshBtn.classList.remove('loading');
            refreshBtnText.textContent = "Refresh Feed";
            loadingSkeletons.classList.add('hidden');
            updatesGrid.classList.remove('hidden');
        }
    }

    // Render Category Pills
    function renderCategoryPills(categories) {
        // Retain active category pill if valid
        const pillsHtml = `
            <button class="pill ${activeCategory === 'ALL' ? 'active' : ''}" data-category="ALL">All Updates</button>
            ${categories.map(cat => `
                <button class="pill ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">${cat}</button>
            `).join('')}
        `;
        categoryPillsContainer.innerHTML = pillsHtml;

        // Add Pill Click Handler
        categoryPillsContainer.querySelectorAll('.pill').forEach(pill => {
            pill.addEventListener('click', () => {
                categoryPillsContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                activeCategory = pill.dataset.category;
                applyFiltersAndRender();
            });
        });
    }

    // Render Tag Filter Options
    function renderTagOptions(tags) {
        tagSelect.innerHTML = `
            <option value="ALL" ${activeTag === 'ALL' ? 'selected' : ''}>All Topics</option>
            ${tags.map(tag => `<option value="${tag}" ${activeTag === tag ? 'selected' : ''}>${tag}</option>`).join('')}
        `;
    }

    // Filter & Sort Logic
    function applyFiltersAndRender() {
        const query = searchInput.value.trim().toLowerCase();

        filteredUpdates = allUpdates.filter(update => {
            // Category Filter
            if (activeCategory !== 'ALL' && update.category.toLowerCase() !== activeCategory.toLowerCase()) {
                return false;
            }

            // Tag Filter
            if (activeTag !== 'ALL' && (!update.tags || !update.tags.includes(activeTag))) {
                return false;
            }

            // Bookmark Filter
            if (showOnlyBookmarks && !bookmarks.has(update.id)) {
                return false;
            }

            // Search Keyword Filter
            if (query) {
                const searchHaystack = `${update.headline} ${update.summary} ${update.category} ${update.date} ${(update.tags || []).join(' ')}`.toLowerCase();
                if (!searchHaystack.includes(query)) {
                    return false;
                }
            }

            return true;
        });

        // Sorting
        const sortMode = sortSelect.value;
        if (sortMode === 'OLDEST') {
            filteredUpdates.reverse();
        }

        // Render Cards
        renderCards(filteredUpdates);
        updateActiveFiltersBanner();
    }

    // Render Release Note Cards
    function renderCards(updates) {
        if (updates.length === 0) {
            updatesGrid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        updatesGrid.classList.remove('hidden');

        updatesGrid.innerHTML = updates.map(update => {
            const isBookmarked = bookmarks.has(update.id);
            const badgeClass = getBadgeClass(update.category);

            return `
                <article class="update-card glass-card" data-id="${update.id}">
                    <div>
                        <div class="card-header">
                            <span class="badge ${badgeClass}">${escapeHtml(update.category)}</span>
                            <span class="card-date">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                ${escapeHtml(update.date)}
                            </span>
                        </div>

                        <h3 class="card-headline">${escapeHtml(update.headline)}</h3>
                        
                        <div class="card-body-content">
                            ${update.content_html || escapeHtml(update.summary)}
                        </div>

                        ${update.tags && update.tags.length > 0 ? `
                            <div class="card-tags">
                                ${update.tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>

                    <div class="card-actions">
                        <button class="tweet-btn-card" data-action="tweet" data-id="${update.id}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                            Tweet Update
                        </button>

                        <div class="action-icon-group">
                            <button class="btn-icon btn-bookmark ${isBookmarked ? 'bookmarked' : ''}" data-action="bookmark" data-id="${update.id}" title="${isBookmarked ? 'Remove Bookmark' : 'Bookmark update'}">
                                ${isBookmarked ? '⭐' : '☆'}
                            </button>
                            
                            <button class="btn-icon" data-action="copy" data-id="${update.id}" title="Copy summary text">
                                📋
                            </button>

                            <a href="${escapeHtml(update.link)}" target="_blank" rel="noopener" class="btn-icon" title="View official doc source">
                                🔗
                            </a>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        // Attach Card Event Listeners
        updatesGrid.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                const updateItem = allUpdates.find(u => u.id === id);

                if (!updateItem) return;

                if (action === 'tweet') {
                    openTweetModal(updateItem);
                } else if (action === 'bookmark') {
                    toggleBookmark(id);
                } else if (action === 'copy') {
                    copyToClipboard(`${updateItem.headline}\n\n${updateItem.summary}\n\nDetails: ${updateItem.link}`);
                    showToast("Summary copied to clipboard!");
                }
            });
        });
    }

    function getBadgeClass(cat) {
        const lower = cat.toLowerCase();
        if (lower.includes('feature')) return 'badge-feature';
        if (lower.includes('change') || lower.includes('issue')) return 'badge-change';
        if (lower.includes('deprecation')) return 'badge-deprecation';
        return 'badge-announcement';
    }

    // Tweet Modal Logic
    function openTweetModal(update) {
        currentUpdateForTweet = update;
        modalUpdateCategory.textContent = update.category;
        modalUpdateCategory.className = `badge ${getBadgeClass(update.category)}`;
        modalUpdateDate.textContent = update.date;
        modalUpdateHeadline.textContent = update.headline;

        // Apply active template
        applyTweetTemplate(activeTemplate);

        tweetModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeTweetModal() {
        tweetModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    function applyTweetTemplate(templateKey) {
        if (!currentUpdateForTweet) return;
        activeTemplate = templateKey;

        // Update template pills
        templateBtns.forEach(btn => {
            if (btn.dataset.template === templateKey) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const u = currentUpdateForTweet;
        let tweetText = "";

        switch (templateKey) {
            case 'short':
                tweetText = `⚡ BigQuery Update (${u.date}): ${u.headline}\n\n#BigQuery #GCP`;
                break;
            case 'announcement':
                tweetText = `📢 BigQuery ${u.category} Note:\n\n${u.headline}\n\n🔗 Details: ${u.link}\n#BigQuery #GoogleCloud`;
                break;
            case 'custom':
                tweetText = `${u.headline}\n\n${u.link}`;
                break;
            case 'standard':
            default:
                tweetText = u.tweet_default || `🚀 BigQuery ${u.category} (${u.date}):\n\n${u.headline}\n\nDetails: ${u.link}\n#BigQuery #GoogleCloud #DataEngineering`;
                break;
        }

        tweetTextArea.value = tweetText;
        updateTweetEditorState();
    }

    function updateTweetEditorState() {
        const text = tweetTextArea.value;
        const len = text.length;

        charCount.textContent = len;
        const percent = Math.min(100, (len / 280) * 100);
        charProgressFill.style.width = `${percent}%`;

        if (len > 270) {
            charProgressFill.className = 'progress-fill danger';
        } else if (len > 220) {
            charProgressFill.className = 'progress-fill warning';
        } else {
            charProgressFill.className = 'progress-fill';
        }

        // Live Twitter Card Preview
        liveTweetPreviewText.textContent = text;
    }

    function openTwitterIntent() {
        const text = tweetTextArea.value.trim();
        if (!text) {
            showToast("Tweet text cannot be empty!", "error");
            return;
        }

        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'width=600,height=400');
    }

    // Bookmarking Feature
    function toggleBookmark(id) {
        if (bookmarks.has(id)) {
            bookmarks.delete(id);
            showToast("Removed from bookmarks");
        } else {
            bookmarks.add(id);
            showToast("Saved to bookmarks! ⭐");
        }

        localStorage.setItem('bq_bookmarks', JSON.stringify([...bookmarks]));
        updateBookmarkCountUI();
        applyFiltersAndRender();
    }

    function updateBookmarkCountUI() {
        bookmarkCountSpan.textContent = bookmarks.size;
        if (showOnlyBookmarks) {
            showBookmarksBtn.classList.add('active');
        } else {
            showBookmarksBtn.classList.remove('active');
        }
    }

    // Active Filters Banner Update
    function updateActiveFiltersBanner() {
        const filters = [];
        if (activeCategory !== 'ALL') filters.push(`Category: ${activeCategory}`);
        if (activeTag !== 'ALL') filters.push(`Topic: ${activeTag}`);
        if (showOnlyBookmarks) filters.push(`Bookmarked Only`);
        if (searchInput.value.trim()) filters.push(`Search: "${searchInput.value.trim()}"`);

        if (filters.length > 0) {
            filterSummaryText.textContent = filters.join(' • ');
            activeFiltersBanner.classList.remove('hidden');
        } else {
            activeFiltersBanner.classList.add('hidden');
        }
    }

    function resetAllFilters() {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        activeCategory = 'ALL';
        activeTag = 'ALL';
        tagSelect.value = 'ALL';
        showOnlyBookmarks = false;
        
        categoryPillsContainer.querySelectorAll('.pill').forEach(p => {
            if (p.dataset.category === 'ALL') p.classList.add('active');
            else p.classList.remove('active');
        });

        updateBookmarkCountUI();
        applyFiltersAndRender();
    }

        // Theme Toggle Button
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        const themeToggleIcon = document.getElementById('themeToggleIcon');
        const themeToggleText = document.getElementById('themeToggleText');

        let currentTheme = localStorage.getItem('bq_theme') || 'dark';
        applyTheme(currentTheme);

        function applyTheme(theme) {
            currentTheme = theme;
            localStorage.setItem('bq_theme', theme);
            if (theme === 'light') {
                document.body.classList.add('light-theme');
                document.body.classList.remove('dark-theme');
                if (themeToggleIcon) themeToggleIcon.textContent = '🌙';
                if (themeToggleText) themeToggleText.textContent = 'Dark Mode';
            } else {
                document.body.classList.remove('light-theme');
                document.body.classList.add('dark-theme');
                if (themeToggleIcon) themeToggleIcon.textContent = '☀️';
                if (themeToggleText) themeToggleText.textContent = 'Light Mode';
            }
        }

        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
                showToast(`Switched to ${currentTheme} mode`);
            });
        }

        // Export to CSV Button
        const exportCsvBtn = document.getElementById('exportCsvBtn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', exportToCsv);
        }

        // Refresh Button
        refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));

        // Search Input
        searchInput.addEventListener('input', () => {
            if (searchInput.value.length > 0) {
                clearSearchBtn.classList.remove('hidden');
            } else {
                clearSearchBtn.classList.add('hidden');
            }
            applyFiltersAndRender();
        });

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            applyFiltersAndRender();
        });

        // Topic Tag Selector
        tagSelect.addEventListener('change', (e) => {
            activeTag = e.target.value;
            applyFiltersAndRender();
        });

        // Sort Order Select
        sortSelect.addEventListener('change', () => applyFiltersAndRender());

        // Bookmark Toggle Button
        showBookmarksBtn.addEventListener('click', () => {
            showOnlyBookmarks = !showOnlyBookmarks;
            updateBookmarkCountUI();
            applyFiltersAndRender();
        });

        // Reset Filters Buttons
        resetFiltersBtn.addEventListener('click', resetAllFilters);
        emptyStateResetBtn.addEventListener('click', resetAllFilters);

        // Tweet Modal Event Listeners
        closeModalBtn.addEventListener('click', closeTweetModal);
        tweetModal.addEventListener('click', (e) => {
            if (e.target === tweetModal) closeTweetModal();
        });

        templateBtns.forEach(btn => {
            btn.addEventListener('click', () => applyTweetTemplate(btn.dataset.template));
        });

        tweetTextArea.addEventListener('input', updateTweetEditorState);
        openTwitterBtn.addEventListener('click', openTwitterIntent);

        copyTweetBtn.addEventListener('click', () => {
            copyToClipboard(tweetTextArea.value);
            showToast("Tweet text copied to clipboard!");
        });

        // Global Keyboard Shortcut: '/' to focus search box
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && document.activeElement !== searchInput && document.activeElement !== tweetTextArea) {
                e.preventDefault();
                searchInput.focus();
            } else if (e.key === 'Escape' && !tweetModal.classList.contains('hidden')) {
                closeTweetModal();
            }
        });
    }

    // Export CSV Function
    function exportToCsv() {
        if (!filteredUpdates || filteredUpdates.length === 0) {
            showToast("No release notes to export!", "error");
            return;
        }

        const headers = ["Date", "Category", "Headline", "Summary", "Topics", "Official Link"];
        const rows = filteredUpdates.map(u => [
            u.date,
            u.category,
            u.headline,
            u.summary,
            (u.tags || []).join('; '),
            u.link
        ]);

        const csvContent = [
            headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
            ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `bigquery-release-notes-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(`Exported ${filteredUpdates.length} updates to CSV!`);
    }

    // Helper: Copy to Clipboard
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    }

    // Helper: Toast Notifications
    function showToast(msg, type = "info") {
        toastMessage.textContent = msg;
        toastNotification.classList.remove('hidden');
        setTimeout(() => {
            toastNotification.classList.add('hidden');
        }, 3000);
    }

    // Helper: HTML Escape
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }
});
