// Global Variables
let net;
let classifier;
let classNames = []; // Array of strings holding class names
let imageCounts = {}; // Map of className to count

// DOM Elements
const loaderOverlay = document.getElementById('loader-overlay');
const addClassInput = document.getElementById('new-class-name');
const addClassBtn = document.getElementById('add-class-btn');
const classesContainer = document.getElementById('classes-container');
const testUploadZone = document.getElementById('test-upload-zone');
const testImageInput = document.getElementById('test-image-input');
const testImagePreview = document.getElementById('test-image-preview');
const predictionResult = document.getElementById('prediction-result');
const resultClass = document.getElementById('result-class');
const confidenceBar = document.getElementById('confidence-bar');
const resultConfidence = document.getElementById('result-confidence');

// Hidden image element to parse files for TFJS
const hiddenImage = new Image();

// Initialize App
async function init() {
    try {
        console.log('Loading tfjs...');
        // Ensure tfjs is ready
        await tf.ready();

        console.log('Loading mobilenet...');
        // Load MobileNet to extract features
        net = await mobilenet.load();

        console.log('Loading KNN Classifier...');
        // Create the KNN classifier
        classifier = knnClassifier.create();

        // Hide Loader
        loaderOverlay.style.opacity = '0';
        setTimeout(() => loaderOverlay.classList.add('hidden'), 500);

        console.log('Application ready!');

        setupEventListeners();
    } catch (error) {
        console.error('Error initializing models:', error);
        document.getElementById('loader-text').innerText = 'Error loading models.';
        document.getElementById('loader-text').style.color = 'var(--error)';
        document.querySelector('.loader-content p').innerText = error.message;
    }
}

function setupEventListeners() {
    addClassBtn.addEventListener('click', handleAddClass);
    addClassInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddClass();
    });

    // Test Image Upload Event Listeners
    testUploadZone.addEventListener('click', () => testImageInput.click());
    testUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        testUploadZone.style.borderColor = 'var(--accent-primary)';
        testUploadZone.style.background = 'rgba(139, 92, 246, 0.1)';
    });
    testUploadZone.addEventListener('dragleave', () => {
        testUploadZone.style.borderColor = '';
        testUploadZone.style.background = '';
    });
    testUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        testUploadZone.style.borderColor = '';
        testUploadZone.style.background = '';
        if (e.dataTransfer.files.length) {
            handleTestImage(e.dataTransfer.files[0]);
        }
    });
    testImageInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleTestImage(e.target.files[0]);
        }
    });
}

function handleAddClass() {
    const name = addClassInput.value.trim();
    if (!name) return;
    if (classNames.includes(name)) {
        alert('Class already exists!');
        return;
    }

    classNames.push(name);
    imageCounts[name] = 0;
    addClassInput.value = '';

    renderClassCard(name);
}

function renderClassCard(className) {
    const card = document.createElement('div');
    card.className = 'class-card';
    card.id = `class-card-${className}`;

    card.innerHTML = `
        <div class="class-header">
            <h3>${className}</h3>
            <button class="delete-btn" onclick="removeClass('${className}')">×</button>
        </div>
        <div class="class-stats" id="stats-${className}">
            0 images trained
        </div>
        <div class="upload-button-wrapper">
            <button class="btn secondary">Upload Images</button>
            <input type="file" multiple accept="image/*" onchange="handleTrainingImages(this, '${className}')">
        </div>
    `;

    // Add drag and drop listeners directly to the card
    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.style.borderColor = 'var(--accent-primary)';
        card.style.background = 'rgba(139, 92, 246, 0.05)';
    });

    card.addEventListener('dragleave', (e) => {
        card.style.borderColor = '';
        card.style.background = '';
    });

    card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.style.borderColor = '';
        card.style.background = '';

        // Handle files dropped from OS
        if (e.dataTransfer.files.length) {
            handleTrainingFilesDrop(e.dataTransfer.files, className);
        } else {
            // Handle images dragged from our scraper gallery
            const html = e.dataTransfer.getData('text/html');
            const urlMatch = html && html.match(/src\s*=\s*"([^"]+)"/);
            if (urlMatch && urlMatch[1]) {
                fetchImageAndTrain(urlMatch[1], className);
            }
        }
    });

    classesContainer.appendChild(card);
}

function removeClass(className) {
    if (!confirm(`Are you sure you want to remove the class "${className}"? This will reset the model for this class.`)) return;

    // Remove from UI
    const card = document.getElementById(`class-card-${className}`);
    if (card) card.remove();

    // Remove from state
    classNames = classNames.filter(c => c !== className);
    delete imageCounts[className];

    // If we wanted to completely clear KNN memory for a specific class it's tricky because KNN classifier uses indices.
    // The best way for a simple app is just to ignore evaluating it or we clear the whole classifier and rebuild (too complex for now).
    // Simplest approach for a prototype: we can clear the whole classifier if count drops to 0, or we could just warn user.
    // For now, removing just hides it from UI, but conceptually we'd need to clear classifier.clearClass() if passing correct classId.
    classifier.clearClass(className);
}

async function handleStandaloneScrape() {
    const keywordInput = document.getElementById('scrape-keyword');
    const countInput = document.getElementById('scrape-count');
    const statusDiv = document.getElementById('scrape-status');
    const gallery = document.getElementById('scraped-images-gallery');
    const btn = document.getElementById('standalone-scrape-btn');

    const keyword = keywordInput.value.trim();
    const count = parseInt(countInput.value) || 10;

    if (!keyword) {
        alert("Please enter a keyword to search for.");
        return;
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = "Downloading... ⏳";
    btn.disabled = true;
    statusDiv.innerText = "Reaching out to Python Backend...";
    gallery.innerHTML = '';
    gallery.classList.add('hidden');

    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword, count, className: keyword }) // Use keyword as temp class dir
        });

        const result = await response.json();

        if (result.status === 'success' && result.images && result.images.length > 0) {
            statusDiv.innerText = `Successfully downloaded ${result.images.length} images. You can now drag them into your desired classes or right-click to save them!`;
            gallery.classList.remove('hidden');

            result.images.forEach(imgUrl => {
                const img = document.createElement('img');
                img.src = imgUrl;
                img.style.height = '100px';
                img.style.borderRadius = 'var(--radius-sm)';
                img.style.objectFit = 'cover';
                img.draggable = true;

                img.title = "Right click to 'Save Image As...' or just Drag & Drop into your OS folder";

                gallery.appendChild(img);
            });
        } else {
            statusDiv.innerText = "No images found or error occurred: " + (result.message || "Unknown");
        }
    } catch (error) {
        console.error(error);
        statusDiv.innerText = "Failed to reach local server. Make sure you are running 'run_scraper.bat'";
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleTrainingFilesDrop(files, className) {
    if (!files.length) return;

    // Find the button to update its text (optional UI enhancement)
    const card = document.getElementById(`class-card-${className}`);
    const btn = card.querySelector('.btn.secondary');
    const originalText = btn.innerText;

    btn.innerText = `Training... 0/${files.length}`;

    for (let i = 0; i < files.length; i++) {
        await processAndTrainImage(files[i], className);
        btn.innerText = `Training... ${i + 1}/${files.length}`;
    }

    btn.innerText = originalText;
}

function fetchImageAndTrain(url, className) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
            const tensor = tf.browser.fromPixels(img);
            const resized = tf.image.resizeBilinear(tensor, [224, 224]);
            const logits = net.infer(resized, true);
            classifier.addExample(logits, className);
            tensor.dispose();
            resized.dispose();
            imageCounts[className]++;
            document.getElementById(`stats-${className}`).innerText = `${imageCounts[className]} images trained`;
            await new Promise(r => setTimeout(r, 10));
            resolve();
        };
        img.onerror = reject;
        img.src = url;
    });
}

async function handleTrainingImages(fileInput, className) {
    const files = fileInput.files;
    if (!files.length) return;

    const btn = fileInput.previousElementSibling;
    const originalText = btn.innerText;
    btn.innerText = `Training... 0/${files.length}`;
    fileInput.style.display = 'none'; // prevent repeated clicks

    for (let i = 0; i < files.length; i++) {
        await processAndTrainImage(files[i], className);
        btn.innerText = `Training... ${i + 1}/${files.length}`;
    }

    // Reset file input
    btn.innerText = originalText;
    fileInput.style.display = 'block';
    fileInput.value = '';
}

function processAndTrainImage(file, className) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = async () => {
                // Get image tensor
                const tensor = tf.browser.fromPixels(img);

                // Resize for much faster processing (MobileNet optimal size is 224)
                const resized = tf.image.resizeBilinear(tensor, [224, 224]);

                // Pass through MobileNet to get features
                const logits = net.infer(resized, true); // true = intermediate activations

                // Add to KNN model labeled with the className
                classifier.addExample(logits, className);

                // Cleanup tensor
                tensor.dispose();
                resized.dispose();

                // Update UI
                imageCounts[className]++;
                document.getElementById(`stats-${className}`).innerText = `${imageCounts[className]} images trained`;

                // Yield to main thread
                await new Promise(r => setTimeout(r, 10));

                resolve();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function handleTestImage(file) {
    if (classNames.length === 0 || Object.values(imageCounts).every(c => c === 0)) {
        alert("Please create at least one class and add training images before predicting.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        // Show preview
        testImagePreview.src = e.target.result;
        testImagePreview.classList.remove('hidden');
        document.querySelector('.upload-prompt').classList.add('hidden');

        // Process image
        const img = new Image();
        img.onload = async () => {
            const tensor = tf.browser.fromPixels(img);
            const resized = tf.image.resizeBilinear(tensor, [224, 224]);
            const logits = net.infer(resized, true);

            // Predict
            const totalImages = Object.values(imageCounts).reduce((a, b) => a + b, 0);
            const k = Math.min(3, totalImages);
            const prediction = await classifier.predictClass(logits, k);

            displayResult(prediction);
            tensor.dispose();
            resized.dispose();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function displayResult(prediction) {
    predictionResult.classList.remove('hidden');

    const label = prediction.label;
    // Map probabilities object to match confidence
    const confidence = prediction.confidences[prediction.label];
    const percentage = Math.round(confidence * 100);

    resultClass.innerText = label;
    resultConfidence.innerText = `${percentage}%`;
    confidenceBar.style.width = `${percentage}%`;

    // Update color based on confidence
    if (percentage > 80) {
        confidenceBar.style.background = 'var(--success)';
        resultClass.style.color = 'var(--success)';
    } else if (percentage > 50) {
        confidenceBar.style.background = 'var(--accent-primary)';
        resultClass.style.color = 'var(--accent-primary)';
    } else {
        confidenceBar.style.background = 'var(--error)';
        resultClass.style.color = 'var(--error)';
    }
}

// Start app
window.addEventListener('DOMContentLoaded', init);
