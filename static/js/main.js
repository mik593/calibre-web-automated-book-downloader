// Main application JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        search: {
            searchInput: document.getElementById('search-input'),
            searchButton: document.getElementById('search-button'),
            advanced: {
                searchFiltersForm: document.getElementById('search-filters'),
                addFilterButtons: document.getElementsByClassName('add-filter-button')
            }
        },
        resultsSectionAccordion: document.getElementById('results-section-accordion'),
        searchAccordion: document.getElementById('search-accordion'),
        resultsHeading: document.getElementById('results-heading'),
        resultsTable: document.getElementById('results-table'),
        resultsTableBody: document.querySelector('#results-table tbody'),
        searchLoading: document.getElementById('search-loading'),
        statusLoading: document.getElementById('status-loading'),
        statusTable: document.getElementById('status-table'),
        statusTableBody: document.querySelector('#status-table tbody'),
        modalOverlay: document.getElementById('modal-overlay'),
        detailsContainer: document.getElementById('details-container')
    };

    // State
    let currentBookDetails = null;
    const STATE = {
        isSearching: false,
        isLoadingDetails: false,
    };

    // Constants
    const REFRESH_INTERVAL = 60000; // 60 seconds
    const API_ENDPOINTS = {
        search: '/request/api/search',
        info: '/request/api/info',
        download: '/request/api/download',
        status: '/request/api/status'
    };
    const FILTERS = ['isbn', 'author', 'title'];

    // Utility Functions
    const utils = {
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        showLoading(element) {
            element.removeAttribute('hidden');
        },

        hideLoading(element) {
            element.setAttribute('hidden', '');
        },

        showAccordion(element) {
            UIkit.accordion(element).toggle(1, true);
        },

        async fetchJson(url, options = {}) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Fetch error:', error);
                throw error;
            }
        },

        createElement(tag, attributes = {}, children = []) {
            const element = document.createElement(tag);
            Object.entries(attributes).forEach(([key, value]) => {
                element[key] = value;
            });
            children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else {
                    element.appendChild(child);
                }
            });
            return element;
        }
    };

    // Search Functions
    const search = {
        async performSearch(query) {
            if (STATE.isSearching) return;
            
            try {
                STATE.isSearching = true;
                utils.showLoading(elements.searchLoading);

                if (!elements.searchAccordion.classList.contains('uk-open'))
                {
                    utils.showAccordion(elements.resultsSectionAccordion);
                };
                
                const data = await utils.fetchJson(
                    `${API_ENDPOINTS.search}?${query}`
                );
                
                this.displayResults(data);
            } catch (error) {
                this.handleSearchError(error);
            } finally {
                STATE.isSearching = false;
                utils.hideLoading(elements.searchLoading);
            }
        },

        buildQuery() {
            let queryParams = [];

            if(elements.search.searchInput.value.trim()) {
                queryParams.push(`query=${encodeURIComponent(elements.search.searchInput.value.trim())}`);
            }

            if(elements.search.advanced.searchFiltersForm.hasAttribute('hidden')) {
                //Not advanced search
                return queryParams.join('&');
            }

            FILTERS.forEach(filterType => {
                const inputs = document.querySelectorAll(`[id^="${filterType}-input-"]`);
            
                inputs.forEach(input => {
                    const value = input.value.trim();
                    if (value) {  
                        queryParams.push(`${filterType}=${encodeURIComponent(value.trim())}`);
                    }
                });
            });

            return queryParams.join('&');
        },

        displayResults(books) {
            elements.resultsTableBody.innerHTML = '';
            
            if (!books.length) {
                this.displayNoResults();
                return;
            }

            books.forEach((book, index) => {
                const row = this.createBookRow(book, index);
                elements.resultsTableBody.appendChild(row);
            });
        },

        displayNoResults() {
            const row = utils.createElement('tr', {}, [
                utils.createElement('td', {
                    colSpan: '10',
                    textContent: 'No results found.'
                })
            ]);
            elements.resultsTableBody.appendChild(row);
        },

        createBookRow(book, index) {
            return utils.createElement('tr', {}, [
                utils.createElement('td', { textContent: index + 1 }),
                this.createPreviewCell(book.preview),
                utils.createElement('td', { textContent: book.title || 'N/A' }),
                utils.createElement('td', { textContent: book.author || 'N/A' }),
                utils.createElement('td', { textContent: book.publisher || 'N/A' }),
                utils.createElement('td', { textContent: book.year || 'N/A' }),
                utils.createElement('td', { textContent: book.language || 'N/A' }),
                utils.createElement('td', { textContent: book.format || 'N/A' }),
                utils.createElement('td', { textContent: book.size || 'N/A' }),
                this.createActionCell(book)
            ]);
        },

        createPreviewCell(previewUrl) {
            if (!previewUrl) {
                return utils.createElement('td', { textContent: 'N/A' });
            }

            const img = utils.createElement('img', {
                src: previewUrl,
                alt: 'Book Preview',
                style: 'max-width: 60px;'
            });

            return utils.createElement('td', {}, [img]);
        },

        createActionCell(book) {
            const buttonDetails = utils.createElement('button', {
                className: 'uk-button uk-button-default uk-align-center uk-margin-small uk-width-1-1',
                onclick: () => bookDetails.show(book.id)
            }, [utils.createElement('span', { textContent: 'Details' })]);

            const downloadButton = utils.createElement('button', {
                className: 'uk-button uk-button-primary uk-align-center uk-margin-small uk-width-1-1',
                onclick: () => bookDetails.downloadBook(book)
            }, [utils.createElement('span', { textContent: 'Download' })]);

            return utils.createElement('td', {}, [buttonDetails, downloadButton]);
        },

        handleSearchError(error) {
            console.error('Search error:', error);
            elements.resultsTableBody.innerHTML = '';
            const errorRow = utils.createElement('tr', {}, [
                utils.createElement('td', {
                    colSpan: '10',
                    textContent: 'An error occurred while searching. Please try again.'
                })
            ]);
            elements.resultsTableBody.appendChild(errorRow);
        }
    };

    // Book Details Functions
    const bookDetails = {
        async show(bookId) {
            if (STATE.isLoadingDetails) return;

            try {
                STATE.isLoadingDetails = true;
                modal.open();
                elements.detailsContainer.innerHTML = '<p>Loading details...</p>';

                const book = await utils.fetchJson(
                    `${API_ENDPOINTS.info}?id=${encodeURIComponent(bookId)}`
                );
                
                currentBookDetails = book;
                this.displayDetails(book);
            } catch (error) {
                this.handleDetailsError(error);
            } finally {
                STATE.isLoadingDetails = false;
            }
        },

        displayDetails(book) {
            elements.detailsContainer.innerHTML = this.generateDetailsHTML(book);
            
            // Add event listeners
            document.getElementById('download-button')
                .addEventListener('click', () => this.downloadBook(book));
            document.getElementById('close-details')
                .addEventListener('click', modal.close);
        },

        generateDetailsHTML(book) {
            return `

                <div class="uk-card uk-card-default uk-child-width-1-2" uk-grid>
                    <div class="uk-card-media-left uk-cover-container uk-padding">
                        <img class="uk-height-medium" src="${book.preview || ''}" alt="Book Preview" uk-cover>
                        <canvas width="299" height="461"></canvas>
                    </div>
                    <div class="uk-card-body">
                        <h3>${book.title || 'No title available'}</h3>
                        <p><strong>Author:</strong> ${book.author || 'N/A'}</p>
                        <p><strong>Publisher:</strong> ${book.publisher || 'N/A'}</p>
                        <p><strong>Year:</strong> ${book.year || 'N/A'}</p>
                        <p><strong>Language:</strong> ${book.language || 'N/A'}</p>
                        <p><strong>Format:</strong> ${book.format || 'N/A'}</p>
                        <p><strong>Size:</strong> ${book.size || 'N/A'}</p>
                    </div>
                    
                    <button id="download-button" class="uk-button uk-button-primary" type="button">Download</button>
                    <button id="close-details" class="uk-button uk-button-default uk-modal-close" type="button">Close</button>
                </div>
                <ul uk-accordion>
                    <li>
                        <a class="uk-accordion-title" href>Further Information</a>
                        <div class="uk-accordion-content">
                            ${this.generateInfoList(book.info)}
                        </div>
                    </li>
                </ul>
            `;
        },

        generateInfoList(info) {
            if (!info) return '';

            const listItems = Object.entries(info)
                .map(([key, values]) => `
                    <li><strong>${key}:</strong> ${values.join(', ')}</li>
                `)
                .join('');

            return `<ul class="uk-list uk-list-bullet">${listItems}</ul>`;
        },

        async downloadBook(book) {
            if (!book) return;

            try {
                utils.showLoading(elements.searchLoading);
                await utils.fetchJson(
                    `${API_ENDPOINTS.download}?id=${encodeURIComponent(book.id)}`
                );
                
                modal.close();
                status.fetch();
            } catch (error) {
                console.error('Download error:', error);
            } finally {
                utils.hideLoading(elements.searchLoading);
            }
        },

        handleDetailsError(error) {
            console.error('Details error:', error);
            elements.detailsContainer.innerHTML = `
                <p>Error loading details. Please try again.</p>
                <div class="details-actions">
                    <button id="close-details" onclick="modal.close()">Close</button>
                </div>
            `;
            document.getElementById('close-details')
                .addEventListener('click', modal.close);
        }
    };

    // Status Functions
    const status = {
        async fetch() {
            try {
                utils.showLoading(elements.statusLoading);
                const data = await utils.fetchJson(API_ENDPOINTS.status);
                this.display(data);
            } catch (error) {
                this.handleError(error);
            } finally {
                utils.hideLoading(elements.statusLoading);
            }
        },

        display(data) {
            elements.statusTableBody.innerHTML = '';
            
            // Handle each status type
            Object.entries(data).forEach(([status, booksInStatus]) => {
                // If the status section has books
                if (Object.keys(booksInStatus).length > 0) {
                    // For each book in this status
                    Object.entries(booksInStatus).forEach(([bookId, bookData]) => {
                        this.addStatusRow(status, bookData);
                    });
                }
            });
        },

        addStatusRow(status, book) {
            if (!book.id || !book.title) return;

            const statusCell = utils.createElement('td', {
                className: `status-${status.toLowerCase()}`,
                textContent: status
            });

            let titleElement;
            if (status.toLowerCase().includes('available')) {
                titleElement = utils.createElement('a', {
                    href: `/request/api/localdownload?id=${book.id}`,
                    target: '_blank',
                    textContent: book.title || 'N/A'
                });
            }
            else {
                titleElement = utils.createElement('td', { textContent: book.title || 'N/A' })
            }

            const row = utils.createElement('tr', {}, [
                statusCell,
                utils.createElement('td', { textContent: book.id }),
                titleElement,
                this.createPreviewCell(book.preview)
            ]);

            elements.statusTableBody.appendChild(row);
        },

        createPreviewCell(previewUrl) {
            const cell = utils.createElement('td');
            
            if (previewUrl) {
                const img = utils.createElement('img', {
                    src: previewUrl,
                    alt: 'Book Preview',
                    style: 'max-width: 60px; height: auto;'
                });
                cell.appendChild(img);
            } else {
                cell.textContent = 'N/A';
            }
            
            return cell;
        },

        handleError(error) {
            console.error('Status error:', error);
            elements.statusTableBody.innerHTML = '';
            
            const errorRow = utils.createElement('tr', {}, [
                utils.createElement('td', {
                    colSpan: '4',
                    className: 'error-message',
                    textContent: 'Error loading status. Will retry automatically.'
                })
            ]);
            
            elements.statusTableBody.appendChild(errorRow);
        }
    };

    // Modal Functions
    const modal = {
        open() {
            elements.modalOverlay.classList.add('active');
        },

        close() {
            elements.modalOverlay.classList.remove('active');
            currentBookDetails = null;
        }
    };

    // Event Listeners
    function setupEventListeners() {
        // Search events
        elements.search.searchButton.addEventListener('click', () => {
            const query = search.buildQuery();
            if(query) search.performSearch(query);
        });

        elements.search.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();

                const query = search.buildQuery();
                if(query) search.performSearch(query);
            }
        });

        // Modal close on overlay click
        elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.modalOverlay) {
                modal.close();
            }
        });

        // Keyboard accessibility
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && elements.modalOverlay.classList.contains('active')) {
                modal.close();
            }
        });

        
        // Search Filter Add Buttons
        const addFilterButtons = Array.from(elements.search.advanced.addFilterButtons);
        addFilterButtons.forEach(x => {
            x.addEventListener('click', () => {
                const filterType = x.id.split('add-filter-')[1];

                const inputs = document.querySelectorAll(`[id^="${filterType}-input-"]`);
                const lastElement = inputs[inputs.length - 1];

                const lastIndex = lastElement ? parseInt(lastElement.id.split('-')[2], 10) : 0

                const newElement = lastElement.parentElement.cloneNode(true);

                const newId = `${filterType}-input-${lastIndex + 1}`;
                const input = newElement.getElementsByTagName('input')[0];
                input.id = newId;
                input.value = '';

                const button = newElement.getElementsByTagName('button')[0];
                button.hidden = false;

                lastElement.parentElement.insertAdjacentElement('afterend', newElement);

                button.addEventListener('click', (e) => {
                    e.target.parentElement.remove();
                });
            })
        });

        // Delete Filter Buttons
        const deleteFilterButtons = Array.from(document.getElementsByClassName('del-filter'));
        deleteFilterButtons.forEach(x => {
            x.addEventListener('click', () => {
                x.closest('.search-filter').remove();
            })
        });
    }

    // Initialize
    function init() {
        setupEventListeners();
        status.fetch();
        setInterval(() => status.fetch(), REFRESH_INTERVAL);
    }

    init();
});