(function() {
  const MANIFEST_URL = 'versions.json';
  const STORAGE_KEY = 'iclassi.selectedVersion';
  const FALLBACK_MANIFEST = {
    current: '0.1.0-prototype',
    versions: [
      {
        id: '0.1.0-prototype',
        label: '0.1.0 (prototype)',
        path: 'versions/0.1.0-prototype/'
      }
    ]
  };

  let readyPromise = null;

  function ready() {
    if (!readyPromise) {
      readyPromise = Promise.all([loadManifest(), domReady()]).then(([manifest]) => {
        const version = resolveSelectedVersion(manifest);
        const context = {
          manifest,
          version,
          versionId: version.id,
          basePath: normalizeBasePath(version.path),
          file: filename => normalizeBasePath(version.path) + filename
        };
        bindVersionControls(context);
        return context;
      });
    }
    return readyPromise;
  }

  function loadManifest() {
    return fetch(MANIFEST_URL)
      .then(response => {
        if (!response.ok) throw new Error(`Could not load ${MANIFEST_URL}`);
        return response.json();
      })
      .then(normalizeManifest)
      .catch(() => normalizeManifest(FALLBACK_MANIFEST));
  }

  function normalizeManifest(manifest) {
    const versions = Array.isArray(manifest.versions) ? manifest.versions : [];
    return {
      current: manifest.current || (versions[0] && versions[0].id) || FALLBACK_MANIFEST.current,
      versions: versions.length ? versions : FALLBACK_MANIFEST.versions
    };
  }

  function resolveSelectedVersion(manifest) {
    const requested = getRequestedVersion();
    const selected = manifest.versions.find(item => item.id === requested)
      || manifest.versions.find(item => item.id === manifest.current)
      || manifest.versions[0];
    try {
      localStorage.setItem(STORAGE_KEY, selected.id);
    } catch (error) {
      // Version selection still works for this page even when storage is blocked.
    }
    return selected;
  }

  function getRequestedVersion() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('version');
    if (fromUrl) return fromUrl;
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function bindVersionControls(context) {
    const selects = document.querySelectorAll('[data-version-select], #versionSelect');
    selects.forEach(select => {
      select.innerHTML = '';
      context.manifest.versions.forEach(version => {
        const option = document.createElement('option');
        option.value = version.id;
        option.textContent = version.label || version.id;
        option.selected = version.id === context.versionId;
        select.appendChild(option);
      });
      select.addEventListener('change', () => changeVersion(select.value));
    });

    document.querySelectorAll('[data-version-label]').forEach(element => {
      element.textContent = context.version.label || context.versionId;
    });
  }

  function changeVersion(versionId) {
    try {
      localStorage.setItem(STORAGE_KEY, versionId);
    } catch (error) {
      // The URL parameter below is enough if storage is not available.
    }
    const url = new URL(window.location.href);
    url.searchParams.set('version', versionId);
    window.location.href = url.toString();
  }

  function normalizeBasePath(path) {
    const basePath = path || '';
    return basePath.endsWith('/') ? basePath : `${basePath}/`;
  }

  function domReady() {
    if (document.readyState !== 'loading') return Promise.resolve();
    return new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }

  window.IclassiVersions = { ready };
  ready();
})();
