function siteSearch() {
    const query = document.getElementById('search-input').value.toLowerCase();

    if (!query) {
        alert('Please enter a search term.');
        return;
    }

    const bodyText = document.body.innerHTML;
    const regExp = new RegExp(query, 'gi');  // Case-insensitive global match
    const highlightedText = bodyText.replace(regExp, function(match) {
        return `<span class="highlight">${match}</span>`;
    });

    // Replace the content of the body with the highlighted text
    document.body.innerHTML = highlightedText;
}
