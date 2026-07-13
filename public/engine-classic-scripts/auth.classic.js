// ============================================================
// Run by Léa — Module d'authentification Supabase (copie classic)
// DÉRIVÉ DE public/v2/engine/auth.js — pas une source de vérité.
// À régénérer manuellement à chaque modification de auth.js
// (mêmes conventions que plan-generator.classic.js / v1-bridge.classic.js /
// gist-sync.classic.js / weather.classic.js — cf. inventaire §3).
//
// Différence avec la version module : pas d'import ES pour le SDK
// Supabase (chargé en amont via <script src="...supabase-js@2"></script>
// classique, qui expose window.supabase.createClient) ; pas d'export,
// tout est attaché à window.LkAuth.
// ============================================================

(function () {
  const SUPABASE_URL = "https://oppwuzbcnhchtokxpzla.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wcHd1emJjbmhjaHRva3hwemxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4OTA0OTMsImV4cCI6MjA5OTQ2NjQ5M30.0TWjUiPO3QbxVmhpGiQ4HPsQSgSq1yUUa9fR-XW5pvk";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function monterEcranAuth(conteneurId) {
    conteneurId = conteneurId || 'ecran-auth-hote';
    const hote = document.getElementById(conteneurId);
    if (!hote) throw new Error('monterEcranAuth: conteneur #' + conteneurId + ' introuvable');

    hote.innerHTML =
      '<style>' +
      '#ecran-auth { position: fixed; inset: 0; z-index: 9999; background: #0f1117; color: #f1f5f9; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; }' +
      '#ecran-auth .carte { width: 100%; max-width: 360px; }' +
      '#ecran-auth .bandeau { text-align: center; margin-bottom: 28px; }' +
      '#ecran-auth .bandeau h1 { font-size: 1.3rem; margin: 0; font-weight: 700; }' +
      '#ecran-auth .bandeau .sous-titre { color: #f97316; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 4px; }' +
      '#ecran-auth .onglets { display: flex; border: 1px solid #2e3347; border-radius: 10px; overflow: hidden; margin-bottom: 20px; }' +
      '#ecran-auth .onglet { flex: 1; padding: 10px; text-align: center; background: #1a1d27; color: #f1f5f9; cursor: pointer; font-size: 0.85rem; border: none; transition: background 0.15s; }' +
      '#ecran-auth .onglet.actif { background: #f97316; color: #0f1117; font-weight: 600; }' +
      '#ecran-auth label { display: block; font-size: 0.8rem; margin-bottom: 4px; color: #9ca3af; }' +
      '#ecran-auth input { width: 100%; padding: 11px 12px; margin-bottom: 14px; border-radius: 8px; border: 1px solid #2e3347; background: #1a1d27; color: #f1f5f9; font-size: 0.95rem; box-sizing: border-box; }' +
      '#ecran-auth input:focus { outline: none; border-color: #f97316; }' +
      '#ecran-auth .btn-principal { width: 100%; padding: 12px; border-radius: 8px; border: none; background: #f97316; color: #0f1117; font-weight: 700; font-size: 0.95rem; cursor: pointer; margin-top: 4px; }' +
      '#ecran-auth .btn-principal:disabled { opacity: 0.5; cursor: not-allowed; }' +
      '#ecran-auth .message { margin-top: 14px; font-size: 0.82rem; text-align: center; min-height: 1.2em; }' +
      '#ecran-auth .message.erreur { color: #f87171; }' +
      '#ecran-auth .message.succes { color: #22c55e; }' +
      '</style>' +
      '<div id="ecran-auth">' +
      '<div class="carte">' +
      '<div class="bandeau"><h1>Run by Léa</h1><div class="sous-titre">Connexion</div></div>' +
      '<div class="onglets">' +
      '<button type="button" class="onglet actif" data-mode="connexion">Se connecter</button>' +
      '<button type="button" class="onglet" data-mode="inscription">Créer un compte</button>' +
      '</div>' +
      '<form id="form-auth">' +
      '<label for="auth-email">Email</label>' +
      '<input type="email" id="auth-email" autocomplete="email" required>' +
      '<label for="auth-password">Mot de passe</label>' +
      '<input type="password" id="auth-password" autocomplete="current-password" required minlength="6">' +
      '<button type="submit" class="btn-principal" id="auth-submit">Se connecter</button>' +
      '<div class="message" id="auth-message"></div>' +
      '</form>' +
      '</div>' +
      '</div>';

    return new Promise(function (resolve) {
      const ecranAuth = hote.querySelector('#ecran-auth');
      const form = hote.querySelector('#form-auth');
      const emailInput = hote.querySelector('#auth-email');
      const passwordInput = hote.querySelector('#auth-password');
      const submitBtn = hote.querySelector('#auth-submit');
      const messageEl = hote.querySelector('#auth-message');
      const onglets = hote.querySelectorAll('#ecran-auth .onglet');

      let mode = 'connexion';
      let dejaResolu = false;

      onglets.forEach(function (btn) {
        btn.addEventListener('click', function () {
          mode = btn.dataset.mode;
          onglets.forEach(function (b) { b.classList.toggle('actif', b === btn); });
          submitBtn.textContent = mode === 'connexion' ? 'Se connecter' : 'Créer mon compte';
          passwordInput.autocomplete = mode === 'connexion' ? 'current-password' : 'new-password';
          messageEl.textContent = '';
        });
      });

      function afficherMessage(texte, type) {
        messageEl.textContent = texte;
        messageEl.className = 'message ' + type;
      }

      function debloquer(user) {
        if (dejaResolu) return;
        dejaResolu = true;
        ecranAuth.style.display = 'none';
        resolve(user);
      }

      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        submitBtn.disabled = true;
        messageEl.textContent = '';
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        try {
          if (mode === 'connexion') {
            const res = await supabase.auth.signInWithPassword({ email: email, password: password });
            if (res.error) throw res.error;
            debloquer(res.data.user);
          } else {
            const res = await supabase.auth.signUp({ email: email, password: password });
            if (res.error) throw res.error;
            if (res.data.session) {
              debloquer(res.data.user);
            } else {
              afficherMessage('Compte créé. Vérifie ta boîte mail pour confirmer avant de te connecter.', 'succes');
            }
          }
        } catch (err) {
          const messages = {
            'Invalid login credentials': 'Email ou mot de passe incorrect.',
            'User already registered': 'Un compte existe déjà avec cet email.',
          };
          afficherMessage(messages[err.message] || err.message, 'erreur');
        } finally {
          submitBtn.disabled = false;
        }
      });

      supabase.auth.getUser().then(function (res) {
        if (res.data.user) debloquer(res.data.user);
      });
    });
  }

  async function deconnecter() {
    const res = await supabase.auth.signOut();
    if (res.error) throw res.error;
  }

  async function utilisateurActuel() {
    const res = await supabase.auth.getUser();
    return res.data.user;
  }

  window.LkAuth = {
    supabase: supabase,
    monterEcranAuth: monterEcranAuth,
    deconnecter: deconnecter,
    utilisateurActuel: utilisateurActuel
  };
})();
