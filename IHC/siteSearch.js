function siteSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) {
        alert('Please enter a search term.');
        return;
    }

    // Remove existing highlights
    document.querySelectorAll('span.highlight').forEach(span => {
        const parent = span.parentNode;
        parent.replaceChild(document.createTextNode(span.textContent), span);
        parent.normalize();
    });

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const tag = node.parentNode.tagName;
            return ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag)
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT;
        }
    });

    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    let firstHighlight = null;

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let lastIndex = 0;
        let match;
        const fragment = document.createDocumentFragment();
        while ((match = regex.exec(text)) !== null) {
            const before = text.slice(lastIndex, match.index);
            if (before) fragment.appendChild(document.createTextNode(before));

            const highlightSpan = document.createElement('span');
            highlightSpan.className = 'highlight';
            highlightSpan.textContent = match[0];
            fragment.appendChild(highlightSpan);
            if (!firstHighlight) firstHighlight = highlightSpan;
            lastIndex = regex.lastIndex;
        }
        const after = text.slice(lastIndex);
        if (after) fragment.appendChild(document.createTextNode(after));

        if (fragment.childNodes.length) {
            node.parentNode.replaceChild(fragment, node);
        }
    });

    if (firstHighlight) {
        firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        alert('No matches found.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('search-input');
    if (input) {
        input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                siteSearch();
            }
        });
    }
});
