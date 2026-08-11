TRD / IEA - Comparateur Avant / Après

1) Installer Python 3.
2) Ouvrir CMD / PowerShell dans le dossier du script.
3) Installer la dépendance :
   pip install -r requirements_TRD.txt

4) Exécuter :
   python TRD_Comparateur_Avant_Apres.py

Le programme demande :
- fichier AVANT
- fichier APRES
- emplacement du résultat

Le résultat est une copie du fichier APRES avec 3 nouveaux onglets :
- Comparatif_TRD
- Dashboard_TRD
- Parametres_TRD

Paramètres par défaut :
- Débit L1800 : 10 Mbps
- Débit L2100 : 5 Mbps
- Débit L2600 : 10 Mbps
- Débit L800 : 5 Mbps
- PRB : 70 %
- IEA = 60 % TRD Débit + 40 % TRD PRB lorsque les deux sont mesurables.

IMPORTANT :
La comparaison de 2 snapshots est indicative. Pour une mesure robuste de l'impact
d'une action, comparer des périodes horaires/BH homogènes et ajouter le Traffic DL
et le nombre d'utilisateurs par bande.
