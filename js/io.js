/**
 * @fileoverview Session import/export — serialises the current RAVEN session
 * (pseudo, generated variants, link states, clicked links) to a JSON file and
 * restores it from a previously exported file.
 */
const IO = (() => {
  /**
   * Exports the current session to a timestamped JSON file and triggers a
   * browser download. The exported file includes:
   * - `schemaVersion` for forward-compatibility checks on import.
   * - `exportedAt` ISO timestamp for provenance.
   * - `session` object containing pseudo, results, link states and clicked links.
   *
   * The filename follows the pattern `raven-session-<pseudo>-<YYYYMMDDTHHmmss>.json`.
   * @returns {void}
   */
  function exportSession() {
    const pseudo = Storage.get('pseudo', '');
    const results = Storage.get('results', null);
    const linkStates = Storage.get('link_states', {});
    const linkClicked = Storage.get('link_clicked', {});

    const now = new Date();
    const ts = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const filename = `raven-session-${pseudo || 'unknown'}-${ts}.json`;

    const data = {
      schemaVersion: 1,
      exportedAt: now.toISOString(),
      session: {
        pseudo,
        results,
        link_states: linkStates,
        link_clicked: linkClicked
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Reads a previously exported session file and restores it to Storage.
   * The user is asked to confirm before overwriting the current session.
   * Site configuration and leet-table selections are **not** affected by an import.
   *
   * @param {File}     file      - The JSON file selected by the user.
   * @param {function({pseudo: string, results: *, link_states: Object, link_clicked: Object}): void} onSuccess
   *   Called with the restored session object when the import succeeds.
   * @param {function(string): void} onError
   *   Called with a human-readable error message when the import fails.
   * @returns {void}
   */
  function importSession(file, onSuccess, onError) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.schemaVersion || data.schemaVersion !== 1) {
          onError('Fichier invalide : schemaVersion non reconnu.');
          return;
        }
        const { session } = data;
        if (!session || typeof session !== 'object') {
          onError('Fichier invalide : données de session manquantes.');
          return;
        }

        const confirmed = confirm(
          "L'import va écraser la session en cours (pseudo, variantes générées, états des liens, liens cliqués).\n" +
          "La configuration des sites et de la table leet n'est pas affectée.\nContinuer ?"
        );
        if (!confirmed) return;

        Storage.set('pseudo', session.pseudo || '');
        Storage.set('results', session.results || null);
        Storage.set('link_states', session.link_states || {});
        Storage.set('link_clicked', session.link_clicked || {});

        onSuccess(session);
      } catch {
        onError('Erreur de parsing JSON. Vérifiez que le fichier est valide.');
      }
    };
    reader.readAsText(file);
  }

  return { exportSession, importSession };
})();
