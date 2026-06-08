const IO = (() => {
  function exportSession() {
    const pseudo = Storage.get('pseudo', '');
    const results = Storage.get('results', null);
    const linkStates = Storage.get('link_states', {});
    const linkClicked = Storage.get('link_clicked', {});

    const now = new Date();
    const ts = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const filename = `osint-session-${pseudo || 'unknown'}-${ts}.json`;

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
