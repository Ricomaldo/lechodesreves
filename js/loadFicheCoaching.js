document.addEventListener('DOMContentLoaded', function () {
    const participantSelect = document.getElementById('participant-select');
    const dateSelect = document.getElementById('date-select');
    const notesTextarea = document.getElementById('notes-textarea');
    const today = new Date().setHours(0, 0, 0, 0); // Date du jour sans heure

    // Fonction pour charger les dates
    function chargerDates() {
        const participant = participantSelect.value.toLowerCase(); // Utiliser en minuscule
        console.log("Participant sélectionné :", participant);

        // Réinitialiser le contenu de dateSelect pour éviter les doublons
        dateSelect.innerHTML = ''; 
        dateSelect.options.length = 0; // Supprimer toutes les options

        // Requête Firestore pour récupérer les sessions du participant
        db.collection("Sessions").where("participant", "==", participant)
            .get()
            .then(querySnapshot => {
                let sessions = [];
                let uniqueSessions = {}; // Utiliser un objet pour éviter les doublons
                let lastPastSessionIndex = -1;

                querySnapshot.forEach((doc) => {
                    const session = doc.data();
                    const sessionDate = session.date.seconds * 1000;

                    // Vérifier si l'ID de la session existe déjà dans l'objet uniqueSessions
                    if (!uniqueSessions[doc.id]) {
                        uniqueSessions[doc.id] = true; // Marquer cette session comme déjà ajoutée
                        sessions.push({ ...session, id: doc.id });
                    }
                });

                // Trier les sessions par date
                sessions.sort((a, b) => a.date.seconds - b.date.seconds);

                // Afficher les sessions dans le menu déroulant
                sessions.forEach((session, index) => {
                    const sessionDate = session.date.seconds * 1000;

                    if (sessionDate <= today) {
                        lastPastSessionIndex = index; // Stocker l'index de la dernière session passée
                    }

                    // Ajouter l'option au menu déroulant
                    const option = document.createElement('option');
                    option.value = session.id;
                    option.textContent = new Date(sessionDate).toLocaleDateString();
                    dateSelect.appendChild(option);
                });

                // Sélectionner la dernière session passée (si elle existe)
                if (lastPastSessionIndex !== -1) {
                    dateSelect.selectedIndex = lastPastSessionIndex;
                    chargerNotes(); // Charger les notes de la dernière session passée
                } else if (dateSelect.options.length > 0) {
                    dateSelect.selectedIndex = 0; // Sélectionner la première future
                    chargerNotes();
                }
            }).catch(error => {
                console.error("Erreur lors du chargement des sessions :", error);
            });
    }

    // Fonction pour charger les notes
    function chargerNotes() {
        const sessionId = dateSelect.value;
        if (!sessionId) return;

        db.collection("Sessions").doc(sessionId).get().then((doc) => {
            if (doc.exists) {
                const sessionData = doc.data();
                notesTextarea.value = sessionData.notes || "";
            } else {
                console.log("Aucune donnée trouvée pour la session sélectionnée.");
            }
        }).catch(error => {
            console.error("Erreur lors du chargement des notes :", error);
        });
    }

    // Fonction pour charger les objectifs
    function chargerObjectifs() {
        const participant = participantSelect.value.toLowerCase(); // Utiliser en minuscule
        const objectifContent = document.getElementById('objectif-content');
        objectifContent.innerHTML = ''; // Réinitialiser le contenu
    
        // Requête Firestore pour récupérer les objectifs du participant
        db.collection("Objectifs").where("participant", "==", participant)
            .where("progression", "<", 100) // Filtrer pour les objectifs en cours
            .get()
            .then(querySnapshot => {
                console.log(`Nombre d'objectifs trouvés pour ${participant} : `, querySnapshot.size); // Log pour le nombre d'objectifs

                if (querySnapshot.empty) {
                    console.log("Aucun objectif trouvé pour :", participant);
                    objectifContent.innerHTML = '<p>Aucun objectif trouvé</p>';
                } else {
                    querySnapshot.forEach(doc => {
                        const objectif = doc.data();
                        console.log("Objectif data :", objectif); // Log des objectifs récupérés

                        // Créer une carte pour chaque objectif
                        const objectifCard = document.createElement('div');
                        objectifCard.classList.add('card', 'objectif-card');

                        // Créer l'input range pour la progression
                        const rangeInput = document.createElement('input');
                        rangeInput.type = 'range';
                        rangeInput.min = 0;
                        rangeInput.max = 100;
                        rangeInput.value = parseInt(objectif.progression); // S'assurer que c'est bien un nombre

                        // Vérifier si la progression est à 100% pour appliquer la classe "completed"
                        if (objectif.progression === 100) {
                            rangeInput.classList.add('completed');
                        }

                        // Mettre à jour Firestore lors du changement de valeur
                        rangeInput.addEventListener('input', function () {
                            const newValue = parseInt(this.value);
                            db.collection("Objectifs").doc(doc.id).update({
                                progression: newValue
                            }).then(() => {
                                console.log("Progression mise à jour :", newValue);

                                // Appliquer la classe "completed" si la progression est à 100%
                                if (newValue === 100) {
                                    this.classList.add('completed');

                                    // Afficher une pop-up de félicitations pour l'objectif atteint
                                    setTimeout(() => {
                                        alert(`Bravo ${participant.charAt(0).toUpperCase() + participant.slice(1)} ! Vous avez atteint l'objectif: ${objectif.titre}`);
                                    }, 500);

                                    // Ne supprimer l'objectif qu'après avoir quitté la page
                                    window.addEventListener('beforeunload', function() {
                                        objectifCard.remove();
                                    });
                                } else {
                                    this.classList.remove('completed');
                                }
                            }).catch(error => {
                                console.error("Erreur lors de la mise à jour de la progression :", error);
                            });
                        });

                        // Remplir la carte avec les informations de l'objectif
                        objectifCard.innerHTML = `
                            <h3>${objectif.titre}</h3>
                            <p>${objectif.description} avant le ${new Date(objectif.deadline.seconds * 1000).toLocaleDateString()}.</p>
                        `;

                        // Ajouter l'input range à la carte
                        objectifCard.appendChild(rangeInput);

                        // Ajouter la carte dans le conteneur
                        objectifContent.appendChild(objectifCard);
                    });
                }
            }).catch(error => {
                console.error("Erreur lors du chargement des objectifs :", error);
            });
    }

    // Fonction pour sauvegarder les notes
    function sauvegarderNotes() {
        const sessionId = dateSelect.value;
        if (!sessionId) return;

        const notes = notesTextarea.value; // Récupérer le contenu du textarea

        // Mettre à jour le document Firestore avec les nouvelles notes
        db.collection("Sessions").doc(sessionId).update({
            notes: notes
        }).then(() => {
            console.log("Notes mises à jour !");
        }).catch(error => {
            console.error("Erreur lors de la mise à jour des notes :", error);
        });
    }

    // Charger les dates et les objectifs dès que la page se charge pour le participant sélectionné par défaut
    chargerDates();
    chargerObjectifs();

    // Événements pour changer de participant et recharger les données
    participantSelect.removeEventListener('change', chargerDates); // Éviter les doublons d'événements
    participantSelect.addEventListener('change', chargerDates);
    dateSelect.addEventListener('change', chargerNotes);
    participantSelect.addEventListener('change', function() {
        chargerDates(); // Charger les dates des sessions
        chargerObjectifs(); // Charger les objectifs
    });

    // Ajouter un bouton de sauvegarde
    document.getElementById('save-notes').addEventListener('click', sauvegarderNotes);
});
