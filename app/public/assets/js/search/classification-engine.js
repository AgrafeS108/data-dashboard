// ftvsport_data.js — FTV Sport · couche données + classification
// Tous les exports sur window.*

// ─── RÈGLES DE CLASSIFICATION PAR SCORING ────────────────────────────────────
// Pour chaque sport, on définit 3 niveaux de mots-clés :
//   - strong  (5 pts) : compétitions emblématiques, hashtags propres au sport,
//                       sportifs internationalement connus pour ce sport.
//   - medium  (2 pts) : termes de second rang (autres compétitions, sportifs
//                       moins iconiques, équipements/techniques distinctifs).
//   - weak    (1 pt)  : mots du sport lui-même (« rugby », « tennis »…).
//                       Faible poids car ils peuvent apparaître dans d'autres
//                       sports (« tennis de table » contient « tennis »).
// Pour CHAQUE vidéo, on calcule un score par sport. Le sport vainqueur est
// celui qui a le score le plus élevé. Score 0 ou égalité parfaite → « Autres
// sports / Non classifié ». Cela évite l'effet « le premier qui matche
// gagne » de l'ancienne logique.
//
// Bonus :
//   - Les hashtags du titre (#xxx) sont privilégiés : un hashtag qui matche
//     un mot-clé strong ou medium reçoit +3 supplémentaires (très fiable).
//   - Pour la sous-catégorie (compétition), même logique mais à l'intérieur
//     du sport gagnant.
window.SR_SCORED = [

  // ── FOOTBALL ──────────────────────────────────────────────────────────────
  {s:'Football', i:'⚽', bg:'#EDFAEE', fg:'#1A5C23', comps:[
    // Compétitions féminines en HAUT (testées avant les masculines pour gagner
    // en cas de match double — si un titre dit « féminin » on veut la version F).
    {n:'Équipe de France Féminine', strong:['equipe de france feminine de football','equipe de france feminine football','les bleues du football','bleues du football','bleues du foot','bleues foot','bleues football','equipe de france f','france feminine football','football (f)','foot (f)','les bleues',' bleues ',' bleues.',' bleues,','match des bleues','#bleues','#equipedefranceféminine','#equipedefrancefeminine'], medium:[], weak:[]},
    {n:'Euro Féminin', strong:['euro feminin de football','euro feminin foot','womens euro','women euro','euro 2025 feminin','euro feminines','euro 2025 (f)','euro 2025 f','euro féminin','euro 2025 femmes','euro 2025 women','#eurofeminin','#womenseuro'], medium:[], weak:[]},
    {n:'Coupe du Monde Féminine', strong:['coupe du monde feminine de football','mondial feminin de football','womens world cup','world cup feminine'], medium:[], weak:[]},
    {n:'Ligue des Champions Féminine', strong:['ligue des champions feminine','womens champions league','ucl feminine','wcl '], medium:[], weak:[]},
    {n:'D1 Arkema', strong:['d1 arkema','arkema premiere ligue','première ligue feminine','premiere ligue feminine'], medium:[], weak:[]},

    // Compétitions masculines
    {n:'Équipe de France', strong:['equipe de france de football','equipe de france masculine de football','les bleus football','les bleus de football','bleus du football','bleus foot','bleus football','#equipedefrance','#fff','#lesbleus'], medium:[], weak:[]},
    {n:'Ligue des Nations', strong:['ligue des nations','nations league','ligue de nation','#liguedesnations','#nationsleague'], medium:[], weak:[]},
    {n:'Euro / Qualifications', strong:['euro 2024 football','euro 2028 football','uefa euro','qualifications euro foot','qualif euro foot','eliminatoires euro foot','#euro2024','#euro2028','#ueferaeuro'], medium:[], weak:[]},
    {n:'Coupe du Monde 2026', strong:['coupe du monde de football','mondial de football','world cup 2026','mondial 2026 foot','qualification mondial foot','#coupedumonde','#mondial2026','#worldcup2026'], medium:[], weak:[]},
    {n:'Ligue 1', strong:['ligue 1','ligue1','l1 mcdonald','#ligue1','#l1'], medium:[], weak:[]},
    {n:'Ligue des Champions', strong:['ligue des champions','champions league','ucl ','ldc football','#liguedeschampions','#championsleague','#ucl'], medium:[], weak:[]},
    {n:'Ligue Europa', strong:['ligue europa','europa league','#europaleague'], medium:[], weak:[]},
    {n:'Conference League', strong:['conference league','ligue conference','ligue conférence','#conferenceleague'], medium:[], weak:[]},
    {n:'Coupe de France', strong:['coupe de france','#coupedefrance'], medium:[], weak:[]},
    {n:'Trophée des Champions', strong:['trophee des champions','trophée des champions','#tropheedeschampions'], medium:[], weak:[]},
  ],
   strong:['#football','#foot','#fff','#equipedefrance','#bleus','#bleues',
     // Joueurs masculins (français) — nom complet ET nom seul
     'kylian mbappe','kylian mbappé','mbappe','mbappé',
     'ousmane dembele','ousmane dembélé','dembele','dembélé',
     'antoine griezmann','griezmann','olivier giroud','giroud',
     'karim benzema','benzema','paul pogba','pogba',
     'ngolo kante','ngolo kanté','kanté','kante',
     'eduardo camavinga','camavinga',
     'aurelien tchouameni','aurélien tchouameni','tchouameni','tchouaméni',
     'marcus thuram','khephren thuram','thuram',
     'adrien rabiot','rabiot','mike maignan','maignan',
     'william saliba','saliba','dayot upamecano','upamecano',
     'ibrahima konate','konate','bradley barcola','barcola',
     'michael olise','olise','randal kolo muani','kolo muani',
     'warren zaire emery','zaire emery','desire doue','desiré doué','doue football',
     'kingsley coman','coman football','jules kounde','jules koundé','kounde','koundé',
     // Légendes du football (vidéos rétro / matchs des légendes / hommages)
     'zinedine zidane','zidane','thierry henry','henry football',
     'michel platini','platini','robert pires','robert pirès','pires football',
     'patrick vieira','vieira','marcel desailly','desailly',
     'lilian thuram','laurent blanc','blanc football',
     'didier deschamps','deschamps','franck ribery','franck ribéry','ribery','ribéry',
     'arsene wenger','arsène wenger','wenger',
     'youri djorkaeff','djorkaeff','christian karembeu','karembeu',
     'fabien barthez','barthez','bixente lizarazu','lizarazu',
     'match des legendes','match des légendes','match des stars',
     'au velodrome','au vélodrome','match au velodrome','match au vélodrome',
     'theo hernandez','théo hernandez','lucas hernandez','randal kolo',
     'eduardo camavinga','jonathan clauss','clauss','lucas digne',
     // Joueuses françaises
     'wendie renard','wendie renard','renard football','grace geyoro','geyoro',
     'kadidiatou diani','diani','sakina karchaoui','karchaoui','marie-antoinette katoto','katoto',
     'eugenie le sommer','eugénie le sommer','le sommer','delphine cascarino','cascarino',
     'selma bacha','bacha football','melvine malard','malard',
     // Joueurs internationaux iconiques
     'lionel messi','messi','cristiano ronaldo','ronaldo','neymar','vinicius junior','vini jr','vinicius',
     'erling haaland','haaland','jude bellingham','bellingham','rodri ',' rodri',
     'pedri ',' pedri','gavi ',' gavi','lamine yamal','yamal',
     'harry kane','kane football','kevin de bruyne','de bruyne',
     'robert lewandowski','lewandowski','mohamed salah','salah','virgil van dijk','van dijk',
     // Clubs français iconiques (pour vidéos sans nom de comp explicite)
     'paris saint germain','paris saint-germain','psg ',' psg.',
     'olympique de marseille','olympique lyonnais','rc lens','as monaco football',
     'om psg','psg om','classico foot'],
   medium:['football feminin','football féminin','football masculin','soccer','football francais','football français','footballeur','footballeuse','attaquant football','milieu de terrain','defenseur central','défenseur central','gardien de but','penalty foot','coup franc','tete decisive','tête décisive'],
   weak:['football','foot ',' foot.']},

  // ── RUGBY ─────────────────────────────────────────────────────────────────
  {s:'Rugby', i:'🏉', bg:'#EEF4FF', fg:'#1A2F6B', comps:[
    // Féminines en haut
    {n:'Six Nations Féminin', strong:['six nations feminin','6 nations feminin','tournoi des six nations feminin','tournoi des 6 nations feminin','women six nations','#sixnationsfeminin','#6nationsfeminin'], medium:[], weak:[]},
    {n:'Coupe du Monde Rugby Féminine', strong:['coupe du monde de rugby feminin','rugby world cup women','rwc women','mondial feminin de rugby'], medium:[], weak:[]},
    {n:'XV de France Féminin', strong:['xv de france feminin','equipe de france feminine de rugby','les bleues du rugby','bleues du rugby','bleues du xv','bleues rugby','#bleuesrugby','#xvdefrancef'], medium:[], weak:[]},

    // Masculines
    {n:'Six Nations', strong:['six nations','6 nations','vi nations','tournoi des six nations','tournoi des 6 nations','#sixnations','#6nations','#tournoidessixnations'], medium:[], weak:[]},
    {n:'Top 14', strong:['top 14','top14','#top14'], medium:[], weak:[]},
    {n:'Champions Cup', strong:['champions cup','champions cup rugby','heineken champions cup','european champions cup','epcr champions','#championscup','#heinekenchampionscup'], medium:[], weak:[]},
    {n:'Challenge Cup', strong:['challenge cup rugby','epcr challenge','#challengecup'], medium:[], weak:[]},
    {n:'Coupe du Monde Rugby', strong:['coupe du monde de rugby','rugby world cup','mondial de rugby','rwc 2027','#coupedumonderugby','#rwc'], medium:[], weak:[]},
    {n:'Rugby à 7', strong:['rugby a 7','rugby à 7','rugby sevens','hsbc svns','svns paris','svns dubai','#rugby7','#sevens','#hsbcsvns'], medium:[], weak:[]},
    {n:'Pro D2', strong:['pro d2','prod2','pro d 2','#prod2'], medium:[], weak:[]},
    {n:'Super Rugby', strong:['super rugby pacific','#superrugby'], medium:[], weak:[]},
    {n:'Tournée d\'automne / Été', strong:['tournee d automne rugby','tournée d\'automne rugby','tournee de novembre','tournée de novembre','tournee d ete rugby','tournée d\'été rugby','#tourneeautomne','#tourneeete'], medium:[], weak:[]},
  ],
   strong:['#rugby','#top14','#xv','#xvdefrance','#sixnations','xv de france','xv tricolore',
     // Joueurs français — noms complets ET noms seuls
     'antoine dupont','dupont rugby','romain ntamack','ntamack',
     'gregory alldritt','grégory alldritt','alldritt',
     'gael fickou','gaël fickou','fickou',
     'damian penaud','penaud','peato mauvaka','mauvaka',
     'francois cros','françois cros','cros rugby',
     'romain taofifenua','taofifenua','charles ollivon','ollivon',
     'matthieu jalibert','jalibert','thomas ramos','ramos rugby',
     'cameron woki','woki','paul gabrillagues','gabrillagues',
     'louis bielle biarrey','bielle biarrey','bielle-biarrey',
     'nicolas depoortere','depoortere','emilien gailleton','gailleton',
     'posolo tuilagi','tuilagi','antoine hastoy','hastoy',
     'maxime lucu','lucu','nolann le garrec','le garrec',
     'thibaud flament','flament','romain buros','buros',
     'cyril baille','baille','uini atonio','atonio',
     'gregory fichten','fichten','julien marchand','marchand rugby',
     // Joueuses françaises
     'pauline bourdon','bourdon rugby','romane menager','menager',
     'manae feleu','féleu','laure sansus','sansus',
     'gabrielle vernier','vernier','melissande llorens','llorens',
     'morgane bourgeois','bourgeois rugby','marine menager','menager rugby',
     // Joueurs internationaux iconiques
     'cheslin kolbe','kolbe','siya kolisi','kolisi',
     'maro itoje','itoje','owen farrell','farrell rugby',
     'ardie savea','savea','beauden barrett','barrett rugby',
     'jonathan sexton','sexton','caelan doris','doris',
     'finn russell','russell rugby','huw jones','huw jones',
     'duhan van der merwe','van der merwe','jamison gibson park','gibson park'],
   medium:['ovalie','quinze de france','demi de melee','demi-de-melee','demi de mêlée','rugbyman','rugbywoman','3eme ligne','3ème ligne','troisieme ligne','troisième ligne','demi d ouverture','demi d\'ouverture','demi de mêlée','centre rugby','ailier rugby'],
   weak:['rugby']},

  // ── TENNIS ────────────────────────────────────────────────────────────────
  {s:'Tennis', i:'🎾', bg:'#EBF9F0', fg:'#1A5C32', comps:[
    {n:'Roland-Garros', strong:['roland garros','roland-garros','rolandgarros','porte d auteuil','porte d\'auteuil','#rolandgarros','#rg2025','#rg2026','#rolandgarros2025','#rolandgarros2026'], medium:[], weak:[]},
    {n:'Wimbledon', strong:['wimbledon','#wimbledon'], medium:[], weak:[]},
    {n:'US Open', strong:['us open de tennis','us open tennis','flushing meadows','#usopen','#usopentennis'], medium:[], weak:[]},
    {n:'Open d\'Australie', strong:['open d australie','open d\'australie','australian open','melbourne tennis','#australianopen','#openaustralie'], medium:[], weak:[]},
    {n:'Masters ATP / WTA Finals', strong:['atp finals','wta finals','nitto atp finals','masters de tennis','#atpfinals','#wtafinals'], medium:[], weak:[]},
    {n:'Coupe Davis', strong:['coupe davis','davis cup','#coupedavis','#daviscup'], medium:[], weak:[]},
    {n:'BJK Cup / Fed Cup', strong:['fed cup','bjk cup','billie jean king cup','#bjkcup','#fedcup'], medium:[], weak:[]},
    {n:'Monte-Carlo', strong:['monte-carlo tennis','monte carlo tennis','rolex monte-carlo','masters de monte carlo','masters de monte-carlo','#montecarlotennis','#rolexmontecarlo'], medium:[], weak:[]},
    {n:'Madrid Open', strong:['madrid open tennis','mutua madrid','#madridopen'], medium:[], weak:[]},
    {n:'Bercy / Paris Masters', strong:['bercy tennis','paris masters tennis','rolex paris masters','#parismasters','#rolexparismasters'], medium:[], weak:[]},
  ],
   strong:['#tennis','#atp','#wta',
     // Joueurs ATP
     'novak djokovic','djokovic','carlos alcaraz','alcaraz',
     'jannik sinner','sinner','daniil medvedev','medvedev',
     'stefanos tsitsipas','tsitsipas','alexander zverev','zverev',
     'casper ruud','ruud tennis','holger rune','rune tennis',
     'jack draper','draper tennis','arthur fils','fils tennis',
     'arthur rinderknech','rinderknech','ugo humbert','humbert',
     'adrian mannarino','mannarino','gael monfils','gaël monfils','monfils',
     'corentin moutet','moutet','quentin halys','halys',
     'giovanni mpetshi perricard','mpetshi perricard','luca van assche','van assche',
     'taylor fritz','fritz tennis','tommy paul','paul tennis',
     // Joueuses WTA
     'iga swiatek','swiatek','aryna sabalenka','sabalenka',
     'coco gauff','gauff','elena rybakina','rybakina',
     'jessica pegula','pegula','jasmine paolini','paolini',
     'qinwen zheng','zheng tennis','elina svitolina','svitolina',
     'caroline garcia','varvara gracheva','clara burel','burel',
     'diane parry','parry tennis','lois boisson','loïs boisson','boisson tennis',
     'alize cornet','alizé cornet','cornet tennis','kristina mladenovic','mladenovic',
     'ons jabeur','jabeur','barbora krejcikova','krejcikova',
     'mirra andreeva','andreeva','victoria mboko','mboko'],
   medium:['atp tour','wta tour','simple messieurs','simple dames','double messieurs','double dames','grand chelem tennis','tennisman','tenniswoman','tennisfrance','revers tennis','coup droit'],
   weak:['tennis']},

  // ── ATHLÉTISME ────────────────────────────────────────────────────────────
  {s:'Athlétisme', i:'🏃', bg:'#FFF6EC', fg:'#7A3800', comps:[
    {n:'Jeux Olympiques', strong:['athletisme aux jo','athle aux jo','athletisme jeux olympiques','#paris2024','#la2028','#paris2024athletisme'], medium:[], weak:[]},
    {n:'Championnats du Monde', strong:['mondiaux d athletisme','mondiaux d\'athletisme','mondiaux d athle','mondiaux d\'athle','world athletics championships','championnat du monde d athletisme','championnat du monde d\'athletisme','tokyo 2025 athletisme','#mondiauxathle','#mondiauxathletisme','#worldathletics'], medium:[], weak:[]},
    {n:'Championnats d\'Europe', strong:['euro d athletisme','euro d\'athletisme','euro d athle','european athletics','championnats europe athletisme','#euroathle','#euroathletisme'], medium:[], weak:[]},
    {n:'Diamond League', strong:['diamond league','wanda diamond league','#diamondleague'], medium:[], weak:[]},
    {n:'Meeting Paris', strong:['meeting de paris athle','meeting de paris athletisme','istaf paris','paris diamond league','#meetingdeparis'], medium:[], weak:[]},
    {n:'Championnats de France', strong:['championnats de france d athletisme','championnats de france d\'athletisme','championnats de france d athle','elite athletisme','#francathle','#elitesathle'], medium:[], weak:[]},
    {n:'Cross & Route', strong:['cross country','semi-marathon','semi marathon','marathon de paris','marathon de new york','marathon de berlin','marathon de chicago','marathon de boston','marathon de londres','marathon de tokyo','#marathon'], medium:[], weak:[]},
    {n:'Trail & Ultra-trail', strong:['ultra-trail','ultra trail','utmb','diagonale des fous','grand raid de la reunion','grand raid de la réunion','templiers trail','marathon des sables','tor des geants','tor des géants','western states','badwater','ccc chamonix','ttn trail','trans gran canaria','ultra tunnel','ultra-tunnel','#utmb','#ultratrail','#diagonaledesfous','#trail','trail running','course de trail','traileur','traileuse','baptiste chassagne','francois d\'haène','francois d haene','d\'haène','xavier thevenard','thévenard','courtney dauwalter','jim walmsley','kilian jornet','blandine l\'hirondel','l\'hirondel'], medium:['ultra ','ultra-','course ultra','traversee ultra','traversée ultra','en ultra','321 km','100 km','100 miles','166 km','170 km','225 km','dans l\'obscurite','dans l\'obscurité','dans l obscurite','dans l obscurité'], weak:[]},
  ],
   strong:['#athletisme','#athle','#athlétisme','#athlé','#diamondleague','#mondiauxathle',
     // Sportifs internationaux
     'marcell jacobs','jacobs athle','karsten warholm','warholm',
     'jakob ingebrigtsen','ingebrigtsen','faith kipyegon','kipyegon',
     'sifan hassan','hassan athle','shelly-ann fraser-pryce','fraser pryce','fraser-pryce',
     'noah lyles','lyles','armand duplantis','mondo duplantis','duplantis',
     'mutaz essa barshim','barshim','miltiadis tentoglou','tentoglou',
     'malaika mihambo','mihambo','yaroslava mahuchikh','mahuchikh',
     'sydney mclaughlin','mclaughlin','kishane thompson','thompson athle',
     'letsile tebogo','tebogo','femke bol','femke bol',
     'usain bolt','bolt',
     // Sprinteurs / sportifs récents
     'oblique seville','seville sprint','seville sprinter','kishane thompson','thompson sprint',
     'ackeem blake','blake sprinter','andre de grasse','de grasse',
     'fred kerley','kerley','christian coleman','coleman sprinter',
     'erriyon knighton','knighton','kenneth bednarek','bednarek',
     'akani simbine','simbine','zharnel hughes','zharnel hughes',
     // Pattern « roi du / reine du » + distance courante
     'roi du 100 m','roi du 100m','reine du 100 m','reine du 100m',
     'roi du 200 m','roi du 200m','reine du 200 m','reine du 200m',
     'roi du 400 m','roi du 400m','roi du 800 m','roi du 1500 m',
     'champion du 100 m','champion du 100m','champion du 200 m','champion du 200m',
     'finale du 100 m','finale du 100m','finale du 200 m','finale du 200m',
     'finale du 400 m','finale du 110 m haies','finale du saut',
     // Sportifs français
     'kevin mayer','mayer athle','renaud lavillenie','lavillenie',
     'sasha zhoya','zhoya','jimmy gressier','gressier',
     'azeddine habz','habz','cyrena samba mayela','samba mayela','samba-mayela',
     'ryan zeze','zeze','pablo mateo','mateo athle',
     'wilfried happio','happio','melvin raffin','raffin',
     'rouguy diallo','diallo athle','wanyonyi','sembo',
     'gabriel tual','tual','etienne daguinos','daguinos',
     'mehdi-emmanuel abdelwahab','abdelwahab','sounkamba sylla','sylla athle',
     'cyrena samba mayela','helene parisot','parisot athle','justine fedronic','fedronic',
     'rebecca koudouovoh','koudouovoh','floria gueï','gueï','floria guei','guei athle',
     // Patterns numériques distinctifs
     '100m hommes','100m dames','200m hommes','200m dames','400m hommes','400m dames',
     '800m hommes','800m dames','1500m hommes','1500m dames',
     '5000m hommes','5000m dames','10000m hommes','10000m dames',
     '110m haies','100m haies','400m haies','3000m steeple','3000m steeplechase',
     'saut en hauteur','saut a la perche','saut à la perche',
     'saut en longueur','triple saut',
     'lancer du poids','lancer du javelot','lancer du disque','lancer du marteau',
     'decathlon','heptathlon','pole vault','high jump','long jump','triple jump',
     'shot put','hammer throw','javelin throw','discus throw',
     'meeting d athletisme','meeting d\'athletisme','meeting d athlé','meeting d\'athlé'],
   medium:['record du monde athletisme','record d europe athletisme','record du monde du 100m','record du monde du 200m','record du monde du 400m','record du monde du saut','sprint hommes','sprint dames','demi-fond','demi fond','course de fond','course de demi-fond','perchiste','perchistes','sprinteur','sprinteuse','100m en','200m en','400m en','marathon en','semi marathon en','record du monde','record d europe','record d\'europe'],
   weak:['athletisme','athlétisme','athle ','athlé ']},

  // ── NATATION ──────────────────────────────────────────────────────────────
  {s:'Natation', i:'🏊', bg:'#EAF8FF', fg:'#0A5C7A', comps:[
    {n:'Championnats du Monde', strong:['mondiaux de natation','world aquatics','world swimming','championnats du monde de natation','fukuoka natation','doha natation','singapour natation','singapore natation','#mondiauxnatation','#worldaquatics'], medium:[], weak:[]},
    {n:'Championnats d\'Europe', strong:['euro de natation','european swimming','championnats d europe de natation','championnats d\'europe de natation','#euronatation'], medium:[], weak:[]},
    {n:'Championnats de France', strong:['championnats de france de natation','elite natation','nationaux de natation','#francenatation'], medium:[], weak:[]},
    {n:'Water-Polo', strong:['water polo','water-polo','waterpolo','#waterpolo'], medium:[], weak:[]},
    {n:'Natation Artistique', strong:['natation artistique','natation synchronisee','natation synchronisée','synchro natation','#natationartistique'], medium:[], weak:[]},
    {n:'Plongeon', strong:['plongeon de haut vol','high diving','plongeon olympique','tremplin 3m','plateforme 10m','#plongeon'], medium:['plongeon'], weak:[]},
  ],
   strong:['#natation','#swimming','#bassins',
     // Sportifs français
     'leon marchand','léon marchand','marchand natation',
     'florent manaudou','laure manaudou','manaudou',
     'beryl gastaldello','gastaldello','maxime grousset','grousset',
     'yohann ndoye brouard','ndoye brouard','melanie henique','mélanie hénique','henique',
     'marie wattel','wattel','analia pigree','pigrée','pigree',
     'anastasiia kirpichnikova','kirpichnikova','damien joly','joly natation',
     'david aubry','aubry natation','antoine viquerat','viquerat',
     'lucile cifre','cifre','clement secchi','secchi',
     // Internationaux
     'caeleb dressel','dressel','summer mcintosh','mcintosh',
     'katie ledecky','ledecky','ariarne titmus','titmus',
     'mollie o callaghan','o callaghan','sarah sjostrom','sjöström','sjostrom',
     'kaylee mckeown','mckeown','adam peaty','peaty',
     'pan zhanle','pan zhanle','david popovici','popovici'],
   medium:['nage libre','dos crawle','brasse 100m','papillon 200m','4 nages','quatre nages','relais 4x100','relais 4x200','bassin de natation','bassins natation','nageur francais','nageuse francaise','nageur français','nageuse française'],
   weak:['natation','swimming','bassin','bassins']},

  // ── BASKET-BALL ───────────────────────────────────────────────────────────
  {s:'Basket-ball', i:'🏀', bg:'#FFF5EC', fg:'#7A3D00', comps:[
    {n:'Équipe de France Féminine', strong:['equipe de france feminine de basket','les bleues du basket','bleues du basket','bleues basket'], medium:[], weak:[]},
    {n:'EuroBasket Féminin', strong:['eurobasket feminin','euro basket feminin','euro feminin de basket','#eurobasketfeminin','fiba women eurobasket'], medium:[], weak:[]},
    {n:'Coupe du Monde Féminine', strong:['coupe du monde feminine de basket','fiba women world cup'], medium:[], weak:[]},
    {n:'WNBA', strong:['wnba ',' wnba','wnba finals','#wnba'], medium:[], weak:[]},

    {n:'NBA', strong:['nba finals','nba playoffs','nba draft','nba all-star','nba all star','san antonio spurs','los angeles lakers','golden state warriors','boston celtics','oklahoma city thunder','denver nuggets','miami heat','#nba','#nbafinals','#nbaplayoffs'], medium:['nba'], weak:[]},
    {n:'EuroBasket', strong:['eurobasket','euro de basket','euro 2025 basket','fiba eurobasket','#eurobasket'], medium:[], weak:[]},
    {n:'Championnats du Monde', strong:['coupe du monde de basket','fiba world cup basket','mondial de basket','#mondialbasket'], medium:[], weak:[]},
    {n:'Équipe de France', strong:['equipe de france de basket','les bleus du basket','bleus du basket','#bleusbasket'], medium:[], weak:[]},
    {n:'Pro B / Betclic Elite', strong:['betclic elite','jeep elite','pro b basket','ldlc asvel','metropolitans 92','as monaco basket','paris basketball','le mans sarthe basket','jl bourg','#betclicelite'], medium:[], weak:[]},
    {n:'Euroleague', strong:['euroleague basket','euroligue','euroleague basketball','#euroleague'], medium:[], weak:[]},
  ],
   strong:['#nba','#basketball','#basket','#eurobasket',
     // Joueurs français
     'victor wembanyama','wembanyama','wemby ',' wemby',
     'rudy gobert','gobert','nicolas batum','batum',
     'tony parker','tony parker','nando de colo','de colo',
     'frank ntilikina','ntilikina','evan fournier','fournier basket',
     'sylvain francisco','francisco basket','isaia cordinier','cordinier',
     'guerschon yabusele','yabusele','elie okobo','okobo',
     'zaccharie risacher','risacher','alexandre sarr','sarr basket',
     'tidjane salaun','tidjane salaün','salaun basket','salaün',
     'bilal coulibaly','coulibaly basket','matthew strazel','strazel',
     'théo maledon','theo maledon','maledon','mathias lessort','lessort',
     'thomas heurtel','heurtel','vincent poirier','poirier basket',
     // Internationaux
     'lebron james','lebron','stephen curry','steph curry','curry basket',
     'kevin durant','durant basket','giannis antetokounmpo','antetokounmpo',
     'luka doncic','doncic','nikola jokic','jokic',
     'joel embiid','embiid','jayson tatum','tatum',
     'shai gilgeous alexander','sga ',' sga.','gilgeous alexander',
     'anthony edwards','edwards basket','jalen brunson','brunson',
     'devin booker','booker basket','ja morant','morant',
     // Joueuses françaises
     'gabby williams','gabby williams','marine fauthoux','fauthoux',
     'iliana rupert','rupert basket','dominique malonga','malonga basket',
     'leila lacan','lacan','marine johannes','marine johannès','johannes basket'],
   medium:['nba','basket-ball','dunk','3 points clutch','panier a 3 points','panier à 3 points','playoffs basket','rebond basket','contre basket','passe decisive basket','passe décisive basket'],
   weak:['basket','basketball']},

  // ── CYCLISME ──────────────────────────────────────────────────────────────
  {s:'Cyclisme', i:'🚴', bg:'#FDF0F0', fg:'#8B1A1A', comps:[
    {n:'Tour de France Femmes', strong:['tour de france femmes','tdf femmes','tdff','femmes avec zwift','#tdff','#tourdefrancefemmes'], medium:[], weak:[]},
    {n:'Tour de France', strong:['tour de france','tdf 2025','tdf 2026','grande boucle','#tdf','#tourdefrance','#tdf2025','#tdf2026'], medium:[], weak:[]},
    {n:'Giro d\'Italia', strong:['giro d italia','giro d\'italia','tour d italie','tour d\'italie','giro 2025','giro 2026','#giro','#girodonne','#giroditalia'], medium:[], weak:[]},
    {n:'Vuelta', strong:['la vuelta','vuelta a espana','vuelta a españa','tour d espagne','tour d\'espagne','#vuelta','#lavuelta'], medium:[], weak:[]},
    {n:'Paris-Roubaix', strong:['paris-roubaix','paris roubaix','enfer du nord','#parisroubaix'], medium:[], weak:[]},
    {n:'Tour des Flandres', strong:['tour des flandres','ronde van vlaanderen','#flandres','#rvv'], medium:[], weak:[]},
    {n:'Liège-Bastogne-Liège', strong:['liege-bastogne-liege','liège-bastogne-liège','liege bastogne liege','liège bastogne liège','la doyenne','#lbl','#liegebastogneliege'], medium:[], weak:[]},
    {n:'Paris-Nice', strong:['paris-nice','paris nice cyclisme','course au soleil','#parisnice'], medium:[], weak:[]},
    {n:'Tirreno-Adriatico', strong:['tirreno-adriatico','tirreno adriatico','#tirreno'], medium:[], weak:[]},
    {n:'Milan-Sanremo', strong:['milan-sanremo','milan sanremo','milan-san remo','milan san remo','primavera cycliste','#milansanremo','#primavera'], medium:[], weak:[]},
    {n:'Strade Bianche', strong:['strade bianche','#stradebianche'], medium:[], weak:[]},
    {n:'Amstel Gold Race', strong:['amstel gold race','#amstelgold'], medium:[], weak:[]},
    {n:'Flèche Wallonne', strong:['flèche wallonne','fleche wallonne','flèche wallone','fleche wallone','#flechewallonne','mur de huy'], medium:[], weak:[]},
    {n:'Gand-Wevelgem', strong:['gand-wevelgem','gand wevelgem','gent-wevelgem','#gandwevelgem'], medium:[], weak:[]},
    {n:'À travers la Flandre', strong:['a travers la flandre','à travers la flandre','dwars door vlaanderen'], medium:[], weak:[]},
    {n:'E3 Saxo Classic', strong:['e3 saxo','e3 prijs','e3 harelbeke'], medium:[], weak:[]},
    {n:'Cyclo-cross', strong:['cyclo-cross','cyclocross','#cyclocross','coupe du monde cyclo cross','x2o trofee','superprestige cyclo'], medium:[], weak:[]},
    {n:'Critérium du Dauphiné', strong:['critérium du dauphiné','criterium du dauphine','dauphiné libéré','dauphine libere','#dauphine','#dauphiné'], medium:[], weak:[]},
    {n:'Mondiaux cyclisme', strong:['mondiaux de cyclisme','mondiaux du cyclisme','championnats du monde de cyclisme','world championship cycling','mondial cyclisme','mondiaux 2025 a kigali','mondiaux 2025 à kigali','mondiaux kigali','kigali 2025','kigali rwanda','#mondiauxcyclisme','#worldchampionshipcycling','#kigali2025'], medium:[], weak:[]},
    {n:'Critérium International', strong:['critérium international cyclisme','criterium international cyclisme'], medium:[], weak:[]},
  ],
   strong:['#cyclisme','#velo','#vélo',
     // Sportifs masculins
     'tadej pogacar','pogacar','jonas vingegaard','vingegaard',
     'mathieu van der poel','van der poel','mvdp ',' mvdp',
     'wout van aert','van aert','wva ',' wva',
     'remco evenepoel','evenepoel','julian alaphilippe','alaphilippe',
     'romain bardet','bardet','primoz roglic','roglic',
     'egan bernal','bernal','richard carapaz','carapaz',
     'tom pidcock','pidcock','giulio ciccone','ciccone',
     'david gaudu','gaudu','kevin vauquelin','vauquelin',
     'lenny martinez','martinez cyclisme','romain gregoire','romain grégoire','grégoire cyclisme','gregoire cyclisme',
     'jasper philipsen','philipsen','tim merlier','merlier',
     'pavel sivakov','sivakov','valentin paret peintre','paret peintre','paret-peintre',
     'christophe laporte','laporte cyclisme','arnaud demare','arnaud démare','démare','demare',
     'nacer bouhanni','bouhanni','bryan coquard','coquard cyclisme',
     'warren barguil','barguil','thibaut pinot','pinot cyclisme','pierre rolland','rolland cyclisme',
     'anthony turgis','turgis','clément champoussin','champoussin',
     // Sportives féminines
     'demi vollering','vollering','lotte kopecky','kopecky',
     'annemiek van vleuten','van vleuten','elisa longo borghini','longo borghini',
     'pauline ferrand prevot','ferrand prevot','ferrand-prévot','juliette labous','labous',
     'evita muzic','muzic','cedrine kerbaol','kerbaol'],
   medium:['maillot jaune','maillot vert','maillot a pois','maillot à pois','maillot blanc','classement general','classement général','peloton cycliste','col du galibier','col du tourmalet','col du ventoux','mont ventoux','alpe d huez','alpe d\'huez','contre la montre','clm individuel','etape de plaine','étape de plaine','etape de montagne','étape de montagne','sprint final cyclisme'],
   weak:['cyclisme','cycliste','vélo','velo']},

  // ── HANDBALL ──────────────────────────────────────────────────────────────
  {s:'Handball', i:'🤾', bg:'#F0EEFF', fg:'#3B2FA0', comps:[
    {n:'Mondial Féminin Handball', strong:['mondial feminin de handball','mondiaux feminins de handball','coupe du monde feminine de handball','women handball world championship','#mondialfemininhandball'], medium:[], weak:[]},
    {n:'Euro Féminin Handball', strong:['euro feminin de handball','euro feminines handball','women european handball championship','#eurofeminihandball'], medium:[], weak:[]},
    {n:'Équipe de France Féminine', strong:['les bleues du handball','bleues du handball','bleues handball','equipe de france feminine de handball','#bleueshandball'], medium:[], weak:[]},

    {n:'Mondiaux Handball', strong:['mondial de handball','mondiaux de handball','coupe du monde de handball','world handball championship','ihf world','mondial hand','#mondialhandball'], medium:[], weak:[]},
    {n:'Euro Handball', strong:['euro de handball','european handball championship','euro hand','championnat europe handball','#eurohandball'], medium:[], weak:[]},
    {n:'Jeux Olympiques', strong:['handball aux jeux olympiques','handball aux jo','handball olympic'], medium:[], weak:[]},
    {n:'Équipe de France', strong:['les experts du handball','les experts hand','equipe de france de handball','bleus du handball','bleus handball','#bleushandball','#experts'], medium:[], weak:[]},
    {n:'Starligue', strong:['starligue','liqui moly starligue','#starligue'], medium:[], weak:[]},
    {n:'Ligue Butagaz Énergie', strong:['ligue butagaz energie','ligue butagaz énergie','d1 feminine handball','lbe handball','#liguebutagaz'], medium:[], weak:[]},
  ],
   strong:['#handball','#hand',
     // Joueurs masculins
     'nikola karabatic','karabatic','luc abalo','abalo',
     'daniel narcisse','narcisse','michael guigou','michaël guigou','guigou',
     'thierry omeyer','omeyer','vincent gerard','vincent gérard','gerard hand','gérard hand',
     'luka karabatic','nedim remili','remili',
     'melvyn richardson','richardson hand','dika mem','dika mem',
     'elohim prandi','prandi','kentin mahe','kentin mahé','mahé hand','mahe hand',
     // Joueuses
     'allison pineau','pineau','estelle nze minko','nze minko',
     'alanis seyfried','seyfried','laura glauser','glauser',
     'grace zaadi','zaadi','meline nocandy','méline nocandy','nocandy',
     'pauletta foppa','foppa','orlane kanor','kanor',
     'tamara horacek','horacek','lena grandveau','grandveau'],
   medium:['demi-centre handball','arriere gauche handball','arrière gauche handball','arriere droit handball','arrière droit handball','pivot handball','ailier handball','gardien handball','gardienne handball'],
   weak:['handball','hand ']},

  // ── SKI ALPIN, BIATHLON, NORDIQUE ─────────────────────────────────────────
  {s:'Ski & Hiver', i:'⛷️', bg:'#EFF6FF', fg:'#1A4A7C', comps:[
    {n:'Biathlon', strong:['biathlon','sprint biathlon','poursuite biathlon','mass start biathlon','relais biathlon','anterselva biathlon','oberhof biathlon','ruhpolding biathlon','kontiolahti biathlon','hochfilzen biathlon','le grand bornand','#biathlon'], medium:[], weak:[]},
    {n:'Ski Alpin — Coupe du Monde', strong:['coupe du monde de ski','ski alpin','slalom geant','slalom géant','super-g','super g ski','descente ski alpin','descente femmes ski','descente hommes ski','kitzbuhel','kitzbühel','wengen ski','bormio ski','schladming ski','adelboden ski','soldeu ski','val d\'isere ski','val d isere ski','garmisch ski','#skialpin','#coupedumondedeski'], medium:[], weak:[]},
    {n:'Ski Alpin — Mondiaux', strong:['mondiaux de ski alpin','championnats du monde de ski alpin','world ski championships','#mondiauxskialpin'], medium:[], weak:[]},
    {n:'Ski de Fond', strong:['ski de fond','tour de ski','skiathlon','sprint ski de fond','15km ski de fond','30km ski de fond','50km ski de fond','#skidefond'], medium:[], weak:[]},
    {n:'Combiné Nordique', strong:['combine nordique','combiné nordique','nordic combined','#combinenordique'], medium:[], weak:[]},
    {n:'Saut à Ski', strong:['saut à ski','saut a ski','tournee des 4 tremplins','tournée des 4 tremplins','four hills','vol à ski','vol a ski','#sautaski'], medium:[], weak:[]},
    {n:'Patinage', strong:['patinage artistique','patinage de vitesse','short track','figure skating','patinage','#patinage','#figureskating','guillaume cizeron','cizeron','gabriella papadakis','papadakis','laurence fournier-beaudry','fournier-beaudry','adam siao him fa','siao him fa','kevin aymoz','aymoz','loena hendrickx','hendrickx','adelina galyavieva','galyavieva'], medium:[], weak:[]},
    {n:'Snowboard & Freestyle', strong:['snowboard','snowboard cross','ski cross','freestyle ski','aerials','moguls','bosses ski','halfpipe ski','slopestyle ski','big air ski','big air snowboard','#snowboard','#freestyleski'], medium:[], weak:[]},
    {n:'Bobsleigh & Luge', strong:['bobsleigh','bob a 2','bob à 2','bob a 4','bob à 4','skeleton','luge sportive','luge de vitesse','#bobsleigh','#luge'], medium:[], weak:[]},
  ],
   strong:['#ski','#biathlon','#skialpin','#snowboard',
     // Compétitions/JO
     'milano cortina 2026','#milanocortina2026','#milanocortina','#mc2026',
     'jo d hiver','jo d\'hiver','jeux olympiques d hiver','jeux olympiques d\'hiver','jeux d hiver','jeux d\'hiver','#jeuxdhiver',
     // Sportifs français
     'quentin fillon maillet','fillon maillet','julia simon','simon biathlon',
     'justine braisaz','justine braisaz-bouchet','braisaz','braisaz-bouchet',
     'lou jeanmonnot','jeanmonnot','sophie chauveau','chauveau biathlon',
     'eric perrot','éric perrot','perrot biathlon',
     'émilien jacquelin','emilien jacquelin','jacquelin','fabien claude','claude biathlon',
     'jeanne richard','jeanne richard','clement noel','clément noël','noel ski','noël ski',
     'alexis pinturault','pinturault','tessa worley','worley',
     'adrien theaux','theaux','cyprien sarrazin','sarrazin',
     'romane miradoli','miradoli','clarisse breche','breche',
     'lou aluvit','aluvit','renaud jay','jay ski',
     'jules chappaz','chappaz','flora tabanelli','tabanelli',
     // Internationaux
     'johannes thingnes boe','johannes boe','boe biathlon','tarjei boe',
     'sturla holm laegreid','laegreid','vetle sjastad christiansen','christiansen biathlon',
     'elvira oeberg','oeberg','hanna oeberg','franziska preuss','preuss biathlon',
     'mikaela shiffrin','shiffrin','marco odermatt','odermatt',
     'aleksander aamodt kilde','kilde','federica brignone','brignone',
     'lara gut behrami','gut behrami','sofia goggia','goggia',
     'henrik kristoffersen','kristoffersen','marcel hirscher','hirscher'],
   medium:['neige fraiche','neige fraîche','tremplin de saut','poursuite mass start','sprint pursuit','manche de slalom'],
   weak:['ski ','snowboard']},

  // ── VOILE ─────────────────────────────────────────────────────────────────
  {s:'Voile', i:'⛵', bg:'#EBF6FF', fg:'#103A5C', comps:[
    {n:'Vendée Globe', strong:['vendee globe','vendée globe','#vendeeglobe','#vg2024'], medium:[], weak:[]},
    {n:'Route du Rhum', strong:['route du rhum','#routedurhum'], medium:[], weak:[]},
    {n:'Transat Jacques Vabre', strong:['transat jacques vabre','tjv 2025','tjv 2026','#tjv'], medium:[], weak:[]},
    {n:'Jules Verne', strong:['trophee jules verne','trophée jules verne','#julesverne'], medium:[], weak:[]},
    {n:'America\'s Cup', strong:['america\'s cup','americas cup','america cup','coupe de l\'amérique de voile','coupe de l amerique de voile','#americascup'], medium:[], weak:[]},
    {n:'The Ocean Race', strong:['the ocean race','ocean race','#theoceanrace'], medium:[], weak:[]},
  ],
   strong:['#voile','#sailing',
     'charlie dalin','dalin','yoann richomme','richomme',
     'thomas ruyant','ruyant','jeremie beyou','jérémie beyou','beyou',
     'sebastien simon','sébastien simon','simon voile',
     'sam goodchild','goodchild','justine mettraux','mettraux',
     'clarisse cremer','clarisse crémer','crémer','cremer',
     'francois gabart','françois gabart','gabart',
     'armel le cleach','armel le cléac\'h','le cleach','le cléach',
     'imoca 60','imoca','class40','ultim trimaran','figaro beneteau',
     'jean le cam','le cam','vincent riou','riou voile',
     'paul meilhat','meilhat','damien seguin','seguin voile'],
   medium:['skipper français','skipper francais','skippeur','course au large','tour du monde a la voile','tour du monde à la voile'],
   weak:['voile ','sailing']},

  // ── JUDO & SPORTS DE COMBAT ───────────────────────────────────────────────
  {s:'Judo & Combat', i:'🥋', bg:'#F5F2EA', fg:'#4A4025', comps:[
    {n:'Grand Slam Judo Paris', strong:['grand slam de paris','grand chelem de paris judo','paris grand slam judo','#grandslamparis'], medium:[], weak:[]},
    {n:'Grand Slam Judo', strong:['grand slam de judo','grand chelem de judo','grand slam abu dhabi','grand slam tbilisi','grand slam dusseldorf','grand slam baku','grand slam bakou','grand slam astana','grand slam tashkent','grand slam linz','grand slam tokyo','#grandslamjudo'], medium:[], weak:[]},
    {n:'Mondiaux Judo', strong:['mondiaux de judo','world judo championships','championnats du monde de judo','mondial de judo','#mondiauxjudo'], medium:[], weak:[]},
    {n:'Championnats d\'Europe Judo', strong:['euro de judo','european judo championships','championnats europe judo','#eurojudo'], medium:[], weak:[]},
    {n:'Boxe', strong:['boxe anglaise','boxing world','poids lourd','poids welter','poids plume','poids leger','poids léger','poids moyen','tony yoka','estelle mossely','sofiane oumiha','wbc','wba','wbo','ibf','#boxe','#boxing'], medium:['boxe'], weak:[]},
    {n:'Escrime', strong:['escrime fleuret','escrime sabre','escrime epee','escrime épée','romain cannone','manon brunet','enzo lefort','ysaora thibus','maxime pauty','sara balzer','#escrime'], medium:['escrime','fleuret','sabre','epee'], weak:[]},
    {n:'Lutte', strong:['lutte libre','lutte greco','lutte gréco','wrestling olympic','#lutte'], medium:['lutte'], weak:[]},
    {n:'Karaté & Taekwondo', strong:['karate kata','karate kumite','karaté kata','karaté kumite','taekwondo','arts martiaux mixtes','#karate','#taekwondo'], medium:['karate','karaté'], weak:[]},
    {n:'MMA', strong:['ufc fight','mma combat','cage octogonale','ciryl gane','manon fiorot','benoit saint denis','benoît saint denis','francis ngannou','#mma','#ufc'], medium:['mma','ufc'], weak:[]},
  ],
   strong:['#judo','#boxe','#mma','#ufc','#escrime',
     'teddy riner','riner','clarisse agbegnenou','agbegnenou',
     'romane dicko','dicko','margaux pinot','pinot judo',
     'luka mkheidze','mkheidze','joan-benjamin gaba','gaba judo',
     'priscilla gneto','gneto','sarah leonie cysique','cysique',
     'marie eve gahie','marie-eve gahie','gahie',
     'madeleine malonga','malonga judo','alexis mathieu judo','mathieu judo',
     'shirine boukli','boukli','blandine pont','pont judo',
     'barbara matic','matic judo','walide khyar','khyar',
     'maxime gael ngayap hambou','ngayap hambou','daikii bouba','bouba judo'],
   medium:['ippon','waza-ari','waza ari','combattant','combattante','tatami','dojo','arts martiaux'],
   weak:['judo','combat']},

  // ── ÉQUITATION ────────────────────────────────────────────────────────────
  {s:'Équitation', i:'🏇', bg:'#F5F0EA', fg:'#5C3A10', comps:[
    {n:'CSI Paris (Longines)', strong:['longines paris','longines global champions','csio paris','csi paris','jumping de paris','#longines','#csiparis'], medium:[], weak:[]},
    {n:'Mondiaux Équitation', strong:['mondiaux d equitation','mondiaux d\'equitation','mondiaux d équitation','fei world championships','championnat du monde d equitation'], medium:[], weak:[]},
  ],
   strong:['#equitation','#jumping','#equestre',
     'julien epaillard','epaillard','kevin staut','kévin staut','staut',
     'penelope leprevost','pénélope leprevost','leprevost',
     'simon delestre','delestre','olivier perreau','perreau equitation',
     'marie pellegrin','pellegrin','alexandra francart','francart'],
   medium:['saut d obstacle','saut d\'obstacle','dressage equestre','concours hippique','concours complet','endurance equestre','endurance équestre','para-equestre'],
   weak:['equitation','équitation','jumping','polo']},

  // ── SPORTS MOTORISÉS ──────────────────────────────────────────────────────
  {s:'Sports Moteurs', i:'🏎️', bg:'#F5F5F5', fg:'#2A2A2A', comps:[
    {n:'Formule 1', strong:['formule 1','formula 1',' f1 ','grand prix de monaco','grand prix de france','gp de monaco','red bull racing','scuderia ferrari','mercedes amg f1','mclaren f1 team','aston martin f1','#f1','#formula1','#gpmonaco'], medium:[], weak:[]},
    {n:'MotoGP', strong:['motogp','moto gp','moto2','moto3','#motogp','#moto2','#moto3'], medium:[], weak:[]},
    {n:'Rallye', strong:['championnat du monde des rallyes','wrc 2025','wrc 2026','rallye monte-carlo','rallye monte carlo','rallye de france','rallye dakar','dakar 2025','dakar 2026','safari rally','#wrc','#dakar','#rallyedakar','#rallyemontecarlo'], medium:[], weak:[]},
    {n:'Endurance', strong:['24 heures du mans','le mans 24h','wec endurance','#24hdumans','#lemans'], medium:[], weak:[]},
    {n:'Formule E', strong:['formule e','formula e','#formulae'], medium:[], weak:[]},
  ],
   strong:['#f1','#motogp','#wrc','#dakar','#lemans','#sportsmoteurs',
     'max verstappen','verstappen','charles leclerc','leclerc f1',
     'lewis hamilton','hamilton f1','george russell','russell f1',
     'lando norris','norris f1','oscar piastri','piastri',
     'pierre gasly','gasly','esteban ocon','ocon',
     'isack hadjar','hadjar','franco colapinto','colapinto',
     'carlos sainz','sainz f1','fernando alonso','alonso',
     'lance stroll','stroll','sergio perez','sergio pérez','perez f1','pérez f1',
     'marc marquez','marquez','jorge martin','martin motogp',
     'francesco bagnaia','pecco bagnaia','bagnaia',
     'fabio quartararo','quartararo','johann zarco','zarco',
     'enea bastianini','bastianini','aleix espargaro','espargaro',
     'sebastien ogier','sébastien ogier','ogier',
     'sebastien loeb','sébastien loeb','loeb',
     'kalle rovanpera','rovanpera','thierry neuville','neuville',
     'elfyn evans','evans rallye','ott tanak','tanak'],
   medium:['pole position','tour le plus rapide','grille de depart','grille de départ','indycar series','superbike','motocross','supercross','enduro mxgp'],
   weak:['rallye','rally']},

  // ── TENNIS DE TABLE ───────────────────────────────────────────────────────
  {s:'Tennis de table', i:'🏓', bg:'#FEF2F2', fg:'#7A1A1A', comps:[
    {n:'Mondiaux', strong:['mondiaux de tennis de table','world table tennis championships','#mondiauxtennisdetable'], medium:[], weak:[]},
    {n:'Pro Tour WTT', strong:['wtt champions','wtt smash','wtt star contender','wtt contender','world table tennis tour','#wtt','#wttsmash'], medium:[], weak:[]},
  ],
   strong:['#tennisdetable','#pingpong','#tabletennis',
     'tennis de table','table tennis','ping pong','ping-pong',
     'felix lebrun','félix lebrun','lebrun pingpong','f.lebrun',
     'alexis lebrun','simon gauzy','gauzy',
     'prithika pavade','pavade','jia nan yuan','jia nan yuan',
     'ma long','ma long','fan zhendong','fan zhendong',
     'tomokazu harimoto','harimoto','wang chuqin','wang chuqin',
     'sun yingsha','sun yingsha','chen meng','chen meng'],
   medium:[],
   weak:['pongiste']},

  // ── SURF ──────────────────────────────────────────────────────────────────
  {s:'Surf', i:'🏄', bg:'#E8F4FD', fg:'#0A4B8A', comps:[
    {n:'Championship Tour WSL', strong:['world surf league','wsl championship tour','wsl finals','pipe masters','#wsl','#wslchampionshiptour'], medium:[], weak:[]},
    {n:'Étape Teahupoo', strong:['teahupoo','tahiti pro','#teahupoo','#tahitipro'], medium:[], weak:[]},
  ],
   strong:['#surf','#wsl',
     'kauli vaast','vaast','johanne defay','defay',
     'jeremy flores','jérémy florès','flores surf',
     'vahine fierro','fierro','michel bourez','bourez',
     'joan duru','duru','john john florence','john john',
     'gabriel medina','medina','filipe toledo','toledo surf',
     'italo ferreira','ferreira surf','carissa moore','carissa moore',
     'tyler wright','wright surf','caroline marks','marks surf',
     'stephanie gilmore','gilmore','annaelle garreau','annaëlle garreau','garreau surf',
     // Spots de surf emblématiques (Bretagne, Pays Basque, mondiaux)
     'la torche','hossegor','la nord','belharra','la graviere','la gravière',
     'mundaka','jeffreys bay','j-bay','pipeline','snapper rocks','margaret river',
     'bells beach','trestles','sunset beach','bretagne surf','cote basque surf','côte basque surf'],
   medium:['vague monstrueuse','vague geante','vague géante','vague la plus','vague de bretagne','vague de la cote','vague de la côte','vague du jour','la vague','tube surf','barrel surf','line up surf','session de surf','spot de surf','board surf','planche de surf','vague '],
   weak:['surf','surfeur','surfeuse','surfing']},

  // ── SPORTS URBAINS ────────────────────────────────────────────────────────
  {s:'Sports Urbains', i:'🛹', bg:'#F4F0FA', fg:'#4A2A7A', comps:[
    {n:'Skateboard', strong:['skateboard','skate park','skatepark','street league skateboarding','sls skateboard','#skateboard','#skate'], medium:[], weak:[]},
    {n:'BMX Freestyle', strong:['bmx freestyle','bmx park','bmx street','bmx flatland','bmx race','#bmx'], medium:[], weak:[]},
    {n:'Breaking', strong:['breakdance','breaking olympic','b-boy','b-girl','battle de breaking','#breaking','#breakdance'], medium:[], weak:[]},
    {n:'Escalade', strong:['escalade sportive','escalade de difficulte','escalade de difficulté','escalade de bloc','escalade de vitesse','speed climbing','bouldering','#escalade','#climbing'], medium:[], weak:[]},
    {n:'VTT', strong:['vtt cross country','vtt descente','vtt enduro','mountain bike','xco vtt','dh vtt','#vtt','#mountainbike'], medium:[], weak:[]},
    {n:'Parkour', strong:['parkour','#parkour','freerunning'], medium:[], weak:[]},
  ],
   strong:['#skate','#skateboard','#bmx','#breaking','#breakdance','#escalade','#climbing',
     'aurelien giraud','aurélien giraud','giraud skate',
     'vincent milou','milou skate','charlotte hym','hym skate',
     'laury perez','laurie perez','perez skate',
     'joris daudet','daudet bmx','sylvain andre','sylvain andré','andre bmx','andré bmx',
     'axelle etienne','etienne bmx','arthur pilard','pilard bmx',
     'danis civil','civil breaking','syssy breaking',
     'janja garnbret','garnbret','adam ondra','ondra',
     'oriane bertone','bertone escalade','sam avezou','avezou',
     'mickael mawem','mickaël mawem','mawem','bassa mawem'],
   medium:['ollie skate','kickflip','heelflip','grind skate','manual skate','boardslide'],
   weak:[]},

  // ── HOCKEY SUR GLACE ──────────────────────────────────────────────────────
  {s:'Hockey sur glace', i:'🏒', bg:'#E8F0FA', fg:'#1A3A6A', comps:[
    {n:'NHL', strong:['nhl playoffs','stanley cup','nhl draft','national hockey league','#nhl','#stanleycup'], medium:['nhl'], weak:[]},
    {n:'Mondiaux', strong:['mondial de hockey sur glace','world hockey championship','mondiaux hockey iihf','#mondialhockey'], medium:[], weak:[]},
    {n:'Ligue Magnus', strong:['ligue magnus','synerglace ligue magnus','#liguemagnus'], medium:[], weak:[]},
  ],
   strong:['#hockey','#nhl','hockey sur glace','ice hockey',
     'connor mcdavid','mcdavid','sidney crosby','crosby',
     'alexander ovechkin','ovechkin','auston matthews','matthews hockey',
     'nathan mackinnon','mackinnon','leon draisaitl','draisaitl'],
   medium:['hockey','palet','crosse de hockey','gardien de hockey'],
   weak:[]},

  // ── CURLING ───────────────────────────────────────────────────────────────
  {s:'Curling', i:'🥌', bg:'#EAF5EE', fg:'#1A5A3A', comps:[
    {n:'Mondiaux & JO', strong:['mondiaux de curling','world curling championships','curling olympic','curling aux jo','curling jeux olympiques','#mondiauxcurling'], medium:[], weak:[]},
    {n:'Circuit', strong:['grand slam of curling','world curling tour','#grandslamcurling'], medium:[], weak:[]},
  ],
   strong:['#curling','curling'],
   medium:['pierre de curling','glissade curling','balai curling'],
   weak:[]},

  // ── GOLF ──────────────────────────────────────────────────────────────────
  {s:'Golf', i:'⛳', bg:'#F0F7E8', fg:'#3A5A1A', comps:[
    {n:'Majeurs', strong:['masters d augusta','masters d\'augusta','us open de golf','the open championship','british open','pga championship','#mastersaugusta','#usopengolf','#theopen','#pgachampionship'], medium:[], weak:[]},
    {n:'Ryder Cup', strong:['ryder cup','#rydercup'], medium:[], weak:[]},
    {n:'PGA / DP World Tour', strong:['pga tour','dp world tour','liv golf','#pgatour','#dpworldtour','#livgolf'], medium:[], weak:[]},
  ],
   strong:['#golf','#pgatour','#rydercup',
     'tiger woods','tiger ',' tiger.','rory mcilroy','mcilroy',
     'jon rahm','rahm','scottie scheffler','scheffler',
     'viktor hovland','hovland','xander schauffele','schauffele',
     'victor perez','perez golf','antoine rozner','rozner',
     'matthieu pavon','pavon','adrien dumont de chassart','dumont de chassart',
     'romain langasque','langasque'],
   medium:['hole in one','trou en un','birdie golf','eagle golf','albatros golf','swing de golf'],
   weak:['golf','golfeur','golfeuse']},

  // ── SPORTS OLYMPIQUES DIVERS ──────────────────────────────────────────────
  {s:'Sports Olympiques', i:'🥇', bg:'#FFF8E1', fg:'#7A6000', comps:[
    {n:'Tir à l\'Arc', strong:['tir à l arc','tir à l\'arc','tir a l arc','archery world','lisa barbelin','barbelin','jean-charles valladont','valladont','baptiste addis','addis tir','#tiralarc','#archery'], medium:[], weak:[]},
    {n:'Aviron', strong:['aviron skiff','aviron deux de couple','aviron quatre sans barreur','aviron huit','rowing world','aviron','#aviron','#rowing'], medium:[], weak:[]},
    {n:'Canoë-Kayak', strong:['canoe kayak slalom','canoë kayak slalom','course en ligne kayak','marjorie delassus','delassus','boris neveu','neveu kayak','titouan castryck','castryck','nicolas gestin','gestin kayak','#canoekayak','#kayak'], medium:['canoe-kayak','canoë-kayak'], weak:[]},
    {n:'Triathlon', strong:['triathlon olympique','ironman','world triathlon series','cassandre beaugrand','beaugrand','leo bergere','léo bergère','bergere','bergère','vincent luis','luis triathlon','dorian coninx','coninx','emma lombardi','lombardi','pierre le corre','le corre','#triathlon','#ironman'], medium:[], weak:[]},
    {n:'Pentathlon Moderne', strong:['pentathlon moderne','elodie clouvel','clouvel','valentin prades','prades','valentin belaud','belaud','#pentathlon'], medium:[], weak:[]},
    {n:'Haltérophilie', strong:['halterophilie','haltérophilie','weightlifting world','arrache halterophilie','epaule jete halterophilie','#halterophilie','#weightlifting'], medium:[], weak:[]},
    {n:'Volley-ball', strong:['volley-ball','volley ball','volleyball','volley','beach volley','earvin ngapeth','ngapeth','jenia grebennikov','grebennikov','antoine brizard','brizard volley','barthelemy chinenyeze','barthélémy chinenyeze','chinenyeze','trevor clevenot','trévor clevenot','clevenot','nicolas le goff','#volleyball','#beachvolley','#volley'], medium:[], weak:[]},
    {n:'Tir Sportif', strong:['tir sportif','shooting sports','tir au pistolet','tir à la carabine','tir a la carabine','jean quiquampoix','quiquampoix','clement bessaguet','clément bessaguet','bessaguet','#tirsportif'], medium:[], weak:[]},
    {n:'Gymnastique', strong:['gymnastique artistique','gymnastique rythmique','gymnastique','gymnaste','gymnast','simone biles','biles','melanie de jesus dos santos','mélanie de jesus dos santos','de jesus dos santos','kaylia nemour','nemour','marine boyer','boyer gym','rebeca andrade','andrade gym','sunisa lee','sunisa lee','oksana chusovitina','chusovitina','#gymnastique','#gymnastics'], medium:['gym artistique'], weak:[]},
    {n:'Badminton', strong:['badminton world tour','bwf world','viktor axelsen','axelsen','kunlavut vitidsarn','vitidsarn','an seyoung','an seyoung','alex lanier','lanier badminton','#badminton'], medium:['badminton'], weak:[]},
    {n:'Squash', strong:['psa world tour','squash mondial','camille serme','serme squash','#squash'], medium:['squash'], weak:[]},
    {n:'Hockey sur gazon', strong:['hockey sur gazon','field hockey','#hockeysurgazon','#fieldhockey'], medium:[], weak:[]},
    {n:'Rugby à 13', strong:['rugby à 13','rugby a 13','rugby league','super league rugby a 13','dragons catalans','toulouse olympique 13','#rugbyleague','#rugbya13'], medium:[], weak:[]},
  ],
   strong:[],
   medium:[],
   weak:[]},

  // ── PARA SPORTS ───────────────────────────────────────────────────────────
  {s:'Para sport', i:'🥇', bg:'#FAF0F5', fg:'#7A1A4A', comps:[
    {n:'Jeux Paralympiques', strong:['jeux paralympiques','paralympic games','paris 2024 paralympique','milano cortina 2026 paralympique','los angeles 2028 paralympique','#paralympiques','#paralympics','#paris2024paralympique'], medium:[], weak:[]},
    {n:'Para Athlétisme', strong:['para athletisme','para athlétisme','marie amelie le fur','marie-amélie le fur','le fur','timothee adolphe','timothée adolphe','adolphe','nantenin keita','keita para','arnaud assoumani','assoumani'], medium:[], weak:[]},
    {n:'Para Natation', strong:['para natation','ugo didier','didier para','laurent chardard','chardard','alex portal','portal para','emeline pierre','pierre para'], medium:[], weak:[]},
    {n:'Cécifoot / Goalball', strong:['cecifoot','cécifoot','goalball','#cecifoot','#goalball'], medium:[], weak:[]},
    {n:'Tennis Fauteuil', strong:['tennis fauteuil','tennis-fauteuil','wheelchair tennis','stephane houdet','stéphane houdet','houdet','michael jeremiasz','jeremiasz','frederic cattaneo','cattaneo','nicolas peifer','peifer'], medium:[], weak:[]},
    {n:'Para Cyclisme', strong:['para cyclisme','para-cyclisme','handisport cyclisme','marie patouillet','patouillet','alexandre leaute','alexandre léauté','leaute','léauté','kevin le cunff','le cunff'], medium:[], weak:[]},
  ],
   strong:['#parasport','#paralympique','#handisport','para sport','handisport','para olympique'],
   medium:[],
   weak:[]},

  // ── PÉTANQUE ──────────────────────────────────────────────────────────────
  {s:'Pétanque', i:'🟠', bg:'#FAF5E8', fg:'#5A4A1A', comps:[
    {n:'Mondial La Marseillaise', strong:['mondial la marseillaise','mondial à pétanque','mondial a petanque','#lamarseillaise'], medium:[], weak:[]},
    {n:'Championnats du Monde', strong:['championnats du monde de pétanque','championnats du monde de petanque','mondial pétanque','mondial petanque','#mondialpetanque'], medium:[], weak:[]},
  ],
   strong:['#petanque','#pétanque','petanque','pétanque',
     'dylan rocher','rocher petanque','philippe quintais','quintais',
     'henri lacroix','lacroix petanque','christian fazzino','fazzino'],
   medium:['pointeur petanque','pointeur pétanque','tireur petanque','tireur pétanque','carreau petanque','carreau pétanque'],
   weak:['boules lyonnaises']},

  // ── FOOTBALL US (NFL) ─────────────────────────────────────────────────────
  {s:'Football US', i:'🏈', bg:'#FAF0E8', fg:'#7A3A1A', comps:[
    {n:'NFL', strong:['nfl playoffs','super bowl','nfl draft','national football league','#nfl','#superbowl'], medium:['nfl'], weak:[]},
    {n:'NCAA', strong:['college football','ncaa football','#ncaafootball'], medium:[], weak:[]},
  ],
   strong:['#nfl','#superbowl','nfl','football americain','football américain',
     'patrick mahomes','mahomes','aaron rodgers','rodgers',
     'tom brady','brady','josh allen','allen quarterback',
     'jalen hurts','hurts','christian mccaffrey','mccaffrey',
     'travis kelce','kelce','justin jefferson','jefferson nfl'],
   medium:['touchdown nfl','quarterback','running back','wide receiver','touchdown'],
   weak:[]},

  // ── BASEBALL ──────────────────────────────────────────────────────────────
  {s:'Baseball', i:'⚾', bg:'#F5F5F0', fg:'#3A3A1A', comps:[
    {n:'MLB', strong:['mlb world series','mlb playoffs','mlb draft','major league baseball','#mlb','#worldseries'], medium:['mlb'], weak:[]},
    {n:'World Baseball Classic', strong:['world baseball classic','wbc baseball','#worldbaseballclassic'], medium:[], weak:[]},
  ],
   strong:['#mlb','#baseball',
     'shohei ohtani','ohtani','aaron judge','judge baseball',
     'mookie betts','betts','ronald acuna','ronald acuña','acuna','acuña'],
   medium:['home run','strike out','baseball americain','baseball américain'],
   weak:['baseball']},

  // ── E-SPORT ───────────────────────────────────────────────────────────────
  {s:'E-sport', i:'🎮', bg:'#F0F0FA', fg:'#2A2A7A', comps:[
    {n:'League of Legends', strong:['league of legends','lol worlds','lec ','lol esports','lfl ',' lpl ',' lck ','#leagueoflegends','#lolworlds','#lec'], medium:[], weak:[]},
    {n:'Counter-Strike', strong:['counter strike','counter-strike',' cs2 ','cs2 major','blast premier','iem cologne','iem katowice','#cs2','#counterstrike'], medium:[], weak:[]},
    {n:'Valorant', strong:['valorant champions','vct masters','valorant masters','#valorant'], medium:['valorant'], weak:[]},
    {n:'Rocket League', strong:['rocket league championship','rlcs world','rlcs major','#rocketleague','#rlcs'], medium:[], weak:[]},
    {n:'Dota 2', strong:['the international dota','dota 2 major','#dota2','#ti'], medium:[], weak:[]},
    {n:'EA Sports FC', strong:['ea sports fc','fifa esport','fifa world cup esport','#easportsfc','#fifaesport'], medium:[], weak:[]},
  ],
   strong:['#esport','#esports','#gaming','esport','esports'],
   medium:['gamer professionnel','gameuse professionnelle','tournoi gaming','competition gaming','compétition gaming'],
   weak:[]},

  // ── FLÉCHETTES ────────────────────────────────────────────────────────────
  {s:'Fléchettes', i:'🎯', bg:'#FAEEEE', fg:'#5A1A1A', comps:[
    {n:'PDC World Championship', strong:['pdc world darts','pdc world championship','world darts championship','premier league darts','world matchplay darts','world grand prix darts','#pdcworldchampionship','#worlddarts'], medium:[], weak:[]},
  ],
   strong:['#darts','#flechettes','#fléchettes',
     'luke littler','littler','luke humphries','humphries',
     'michael van gerwen','van gerwen','peter wright','wright darts',
     'rob cross','cross darts','gerwyn price','gerwyn price',
     'nathan aspinall','aspinall','michael smith darts','smith darts'],
   medium:['flechettes','fléchettes','darts'],
   weak:[]},

];

// ─── NORMALISATION ────────────────────────────────────────────────────────────
function norm(s){
  return (s||'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/['']/g,"'")
    .replace(/[—–]/g,'-');
}

// Extrait les hashtags du titre, normalisés (sans le #).
function extractHashtags(title){
  const out = [];
  const re = /#([\w\u00C0-\u017F]+)/g;
  let m; while ((m = re.exec(title||''))) out.push(norm(m[1]));
  return out;
}

// Construction du haystack de recherche multi-source.
// V14 : la classification n'utilise plus uniquement le titre.
// On exploite aussi la description et les hashtags, tout en gardant les tags
// YouTube à faible poids car ils peuvent être SEO et trop larges.
function uniq(arr){ return [...new Set((arr||[]).filter(Boolean))]; }
function makeHaystack(text){
  const t = norm(text||'');
  const clean = t.replace(/[^a-z0-9#àâäéèêëîïôöùûüç]+/gi, ' ').replace(/\s+/g,' ').trim();
  return { raw: ' ' + t + ' ', padded: ' ' + clean.replace(/#/g,' #') + ' ' };
}
function buildSearchSources(input, tagsArg=[], descriptionArg=''){
  let title = '', description = '', tags = [];
  if (input && typeof input === 'object') {
    title = input.title || input.snippet?.title || '';
    description = input.description || input.snippet?.description || '';
    tags = Array.isArray(input.tags) ? input.tags : (Array.isArray(input.snippet?.tags) ? input.snippet.tags : []);
  } else {
    title = input || '';
    description = descriptionArg || '';
    tags = Array.isArray(tagsArg) ? tagsArg : [];
  }
  const tagText = tags.join(' ');
  const allText = [title, description, tagText].join(' ');
  return {
    title: makeHaystack(title),
    description: makeHaystack(description),
    tags: makeHaystack(tagText),
    all: makeHaystack(allText),
    hashtags: uniq(extractHashtags([title, description].join(' ')).map(h => h.replace(/[^a-z0-9]/g,''))),
    titleText: title,
    descriptionText: description,
    tagText
  };
}


// Verrouillage titre : une vidéo clairement identifiée par son TITRE ne doit pas
// être déplacée par du bruit dans la description ou les tags SEO.
// Exemple ciblé : un titre Roland-Garros ne doit jamais partir dans Rugby parce
// que la description contient une playlist ou une mention transverse rugby.
const TITLE_SPORT_LOCKS = [
  {sport:'Tennis', comp:'Roland-Garros', weight:120, terms:['roland-garros','roland garros','rolandgarros','porte d auteuil','porte d\'auteuil','#rolandgarros','#rg2025','#rg2026']},
  {sport:'Tennis', comp:'Wimbledon', weight:115, terms:['wimbledon','#wimbledon']},
  {sport:'Tennis', comp:'US Open', weight:115, terms:['us open tennis','us open de tennis','flushing meadows','#usopen']},
  {sport:'Tennis', comp:'Open d\'Australie', weight:115, terms:['open d australie','open d\'australie','australian open','#australianopen']},
  {sport:'Tennis', comp:'Coupe Davis', weight:112, terms:['coupe davis','davis cup','#coupedavis']},
  {sport:'Tennis', comp:'Masters ATP / WTA Finals', weight:108, terms:['atp finals','wta finals','masters 1000','atp 500','atp 250','wta 1000','wta 500','wta 250']},
  {sport:'Tennis', weight:100, terms:['novak djokovic','djokovic','carlos alcaraz','alcaraz','jannik sinner','sinner','iga swiatek','swiatek','aryna sabalenka','sabalenka','coco gauff','gauff','lois boisson','loïs boisson','boisson tennis','gael monfils','gaël monfils','monfils tennis','arthur fils','fils tennis','ugo humbert','humbert tennis','corentin moutet','moutet tennis']},
  {sport:'Tennis', weight:60, terms:['tennisman','tenniswoman','balle de match','balle de break','tie-break','tie break','court central','terre battue tennis','service gagnant']},

  {sport:'Rugby', comp:'Six Nations', weight:120, terms:['six nations','6 nations','tournoi des six nations','tournoi des 6 nations','#sixnations','#6nations']},
  {sport:'Rugby', comp:'Top 14', weight:118, terms:['top 14','top14','#top14']},
  {sport:'Rugby', comp:'Champions Cup', weight:116, terms:['champions cup rugby','champions cup','heineken champions cup','epcr champions','#championscup']},
  {sport:'Rugby', comp:'Challenge Cup', weight:116, terms:['challenge cup rugby','epcr challenge','#challengecup']},
  {sport:'Rugby', comp:'Rugby à 7', weight:112, terms:['rugby a 7','rugby à 7','rugby sevens','hsbc svns','#rugby7','#sevens']},
  {sport:'Rugby', comp:'Pro D2', weight:112, terms:['pro d2','prod2','pro d 2','#prod2']},
  {sport:'Rugby', weight:108, terms:['xv de france','xv tricolore','antoine dupont','romain ntamack','gregory alldritt','grégory alldritt','gael fickou','gaël fickou','damian penaud','thomas ramos','matthieu jalibert','louis bielle-biarrey','louis bielle biarrey','stade toulousain','toulouse rugby','la rochelle rugby','racing 92','union bordeaux begles','union bordeaux bègles','ubb rugby','rc toulon','toulon rugby','clermont rugby','montpellier rugby','castres olympique','usap rugby','bayonne rugby']},
  {sport:'Rugby', weight:60, terms:['rugby','rugbyman','rugbymen','ballon ovale','essai transformé','essai transforme','mêlée','melee rugby','drop rugby','trois-quarts','trois quarts']},

  {sport:'Football', comp:'Ligue des Champions', weight:116, terms:['ligue des champions','champions league','uefa champions league','#ucl']},
  {sport:'Football', comp:'Coupe du Monde 2026', weight:114, terms:['coupe du monde de football','mondial 2026 foot','world cup 2026 football']},
  {sport:'Football', weight:105, terms:['kylian mbappe','kylian mbappé','ousmane dembele','ousmane dembélé','antoine griezmann','equipe de france football','équipe de france football','les bleus football','psg football','olympique de marseille football','football']},

  {sport:'Cyclisme', comp:'Tour de France', weight:120, terms:['tour de france','tdf 2025','tdf 2026','#tourdefrance','#tdf']},
  {sport:'Cyclisme', comp:'Paris-Roubaix', weight:116, terms:['paris-roubaix','paris roubaix','enfer du nord']},
  {sport:'Cyclisme', weight:102, terms:['tadej pogacar','pogacar','jonas vingegaard','vingegaard','mathieu van der poel','van der poel','wout van aert','van aert','remco evenepoel','evenepoel','maillot jaune','peloton','cyclisme']},

  {sport:'Natation', weight:110, terms:['leon marchand','léon marchand','florent manaudou','natation','nage libre','dos crawle','brasse','papillon','4 nages','relais 4x100','relais 4x200']},
  {sport:'Basket-ball', weight:108, terms:['victor wembanyama','wembanyama','wemby','nba','basket-ball','basketball','eurobasket','dunk','panier a 3 points','panier à 3 points']},
  {sport:'Handball', weight:108, terms:['handball','les experts','mondial de handball','euro handball','nikola karabatic','karabatic','dika mem','prandi handball']},
  {sport:'Athlétisme', weight:105, terms:['athletisme','athlétisme','athle','athlé','mondiaux athle','mondiaux athlétisme','100m hommes','100 m hommes','200m hommes','400m haies','saut a la perche','saut à la perche','marathon','diamond league']}
];

function titleContainsTerm(titleHay, term){
  const t = String(term || '');
  if (!t) return false;
  return kwMatches(t, titleHay);
}

function applyTitleSportLock(sources){
  const hits = [];
  for (const lock of TITLE_SPORT_LOCKS) {
    const matched = (lock.terms || []).filter(term => titleContainsTerm(sources.title, term));
    if (!matched.length) continue;
    hits.push({ ...lock, matched, score: lock.weight + Math.min(20, matched.length * 4) });
  }
  if (!hits.length) return null;
  hits.sort((a,b) => b.score - a.score);
  const best = hits[0];
  const second = hits.find(h => h.sport !== best.sport);
  // En cas de conflit fort dans le titre, on laisse le moteur normal arbitrer.
  if (second && Math.abs(best.score - second.score) <= 8) return null;
  // Les verrous faibles servent seulement s'il n'y a pas un autre sport clair.
  if (best.score < 90) return null;
  const sp = (window.SR_SCORED || []).find(x => x.s === best.sport);
  if (!sp) return null;
  return {
    s: sp.s,
    c: best.comp || inferVideoCategoryFromText(sources),
    bg: sp.bg,
    fg: sp.fg,
    i: sp.i,
    _debug:{confidence:'title_lock', score:best.score, kws:best.matched.map(x=>'title.lock:'+x), comp:best.comp||null}
  };
}

// Alias et sports spécifiques ajoutés au-dessus de la base SR_SCORED.
// But : éviter que des vidéos précises finissent dans un gros bloc générique
// comme « Sports Olympiques » ou « Judo & Combat ».
function pushUnique(target, values){
  if (!Array.isArray(target)) return;
  for (const v of values||[]) if (v && !target.includes(v)) target.push(v);
}
function addSpecificSport(def){
  if (!window.SR_SCORED.some(sp => sp.s === def.s)) window.SR_SCORED.push(def);
}
function extendSport(name, patch){
  const sp = window.SR_SCORED.find(x => x.s === name);
  if (!sp) return;
  pushUnique(sp.strong, patch.strong||[]);
  pushUnique(sp.medium, patch.medium||[]);
  pushUnique(sp.weak, patch.weak||[]);
  for (const comp of (patch.comps||[])) {
    const existing = sp.comps.find(c => c.n === comp.n);
    if (existing) {
      pushUnique(existing.strong, comp.strong||[]);
      pushUnique(existing.medium, comp.medium||[]);
      pushUnique(existing.weak, comp.weak||[]);
    } else sp.comps.push(comp);
  }
}

// Quelques sports très présents mais trop souvent noyés dans des catégories larges.
addSpecificSport({s:'Judo', i:'🥋', bg:'#F5F2EA', fg:'#4A4025', comps:[
  {n:'Grand Slam Paris', strong:['grand slam de paris','grand chelem de paris judo','paris grand slam judo'], medium:[], weak:[]},
  {n:'Grand Slam', strong:['grand slam de judo','grand chelem de judo','grand slam baku','grand slam bakou','grand slam tokyo','grand slam tashkent','grand slam astana','grand slam tbilisi'], medium:[], weak:[]},
  {n:'Championnats du Monde', strong:['mondiaux de judo','championnats du monde de judo','world judo championships'], medium:[], weak:[]},
  {n:'Championnats d\'Europe', strong:['euro de judo','championnats europe judo','european judo championships'], medium:[], weak:[]}
], strong:['#judo','judo','teddy riner','riner','clarisse agbegnenou','agbegnenou','romane dicko','dicko','shirine boukli','boukli','luka mkheidze','mkheidze','joan-benjamin gaba','gaba judo','madeleine malonga','malonga judo','marie eve gahie','marie-eve gahie','gahie','sarah leonie cysique','cysique'], medium:['ippon','waza-ari','waza ari','tatami','dojo'], weak:[]});

addSpecificSport({s:'Biathlon', i:'🎯', bg:'#EFF6FF', fg:'#1A4A7C', comps:[
  {n:'Coupe du Monde', strong:['biathlon - coupe du monde','coupe du monde biathlon','coupe du monde de biathlon','world cup biathlon','oberhof','ruhpolding','anterselva','antholz','kontiolahti','hochfilzen','pokljuka','nove mesto biathlon','le grand bornand','grand-bornand biathlon'], medium:['sprint biathlon','poursuite biathlon','mass start biathlon','relais biathlon'], weak:[]},
  {n:'Championnats du Monde', strong:['mondiaux de biathlon','championnats du monde de biathlon','world championships biathlon'], medium:[], weak:[]}
], strong:['#biathlon','biathlon','quentin fillon maillet','fillon maillet','julia simon','simon biathlon','justine braisaz','braisaz-bouchet','lou jeanmonnot','jeanmonnot','emilien jacquelin','émilien jacquelin','jacquelin','eric perrot','éric perrot','perrot biathlon','fabien claude','claude biathlon','sophie chauveau','chauveau biathlon','johannes boe','johannes thingnes boe','boe biathlon','tarjei boe','laegreid','oeberg','preuss biathlon'], medium:['tir couché','tir debout','pas de tir','carabine biathlon'], weak:[]});

addSpecificSport({s:'Volley-ball', i:'🏐', bg:'#FFF8E8', fg:'#7A5400', comps:[
  {n:'Équipe de France', strong:['equipe de france de volley','équipe de france de volley','bleus du volley','les bleus volley','france volley','france volleyball'], medium:[], weak:[]},
  {n:'Ligue des Nations', strong:['volleyball nations league','vnl volley','ligue des nations volley'], medium:[], weak:[]},
  {n:'Euro Volley', strong:['euro volley','championnat d europe de volley','championnat d\'europe de volley'], medium:[], weak:[]},
  {n:'Beach Volley', strong:['beach volley','beach-volley'], medium:[], weak:[]}
], strong:['#volley','#volleyball','volley-ball','volley ball','volleyball','earvin ngapeth','ngapeth','jenia grebennikov','grebennikov','antoine brizard','brizard volley','barthelemy chinenyeze','barthélémy chinenyeze','chinenyeze','trevor clevenot','trévor clevenot','clevenot','nicolas le goff'], medium:['smash volley','contre volley','service ace volley','libero volley'], weak:['volley']});

addSpecificSport({s:'Gymnastique', i:'🤸', bg:'#F5F0FF', fg:'#4B2A7A', comps:[
  {n:'Championnats du Monde', strong:['mondiaux de gymnastique','championnats du monde de gymnastique','world gymnastics championships'], medium:[], weak:[]},
  {n:'Championnats d\'Europe', strong:['euro de gymnastique','championnats d europe de gymnastique','championnats d\'europe de gymnastique'], medium:[], weak:[]},
  {n:'Gymnastique artistique', strong:['gymnastique artistique','barres asymetriques','barres asymétriques','poutre gymnastique','sol gymnastique','saut de cheval','croix de fer','cheval d\'arçons','cheval d arcons','anneaux gymnastique','barre fixe','barres paralleles','barres parallèles'], medium:[], weak:[]}
], strong:['#gymnastique','#gymnastics','gymnastique','gymnaste','simone biles','biles','melanie de jesus dos santos','mélanie de jesus dos santos','de jesus dos santos','kaylia nemour','nemour','marine boyer','boyer gym','rebeca andrade','andrade gym','sunisa lee','dounia gymnaste','gymnastique feminine','gymnastique féminine','salto arrière','salto avant','triple salto','quadruple salto'], medium:['agrès','agres','poutre','barres asymetriques','barres asymétriques','figure de gym','figure gymnique'], weak:[]});

addSpecificSport({s:'Pétanque', i:'🎱', bg:'#F7F3EA', fg:'#5A4010', comps:[
  {n:'Mondial La Marseillaise', strong:['mondial la marseillaise','la marseillaise a petanque','la marseillaise à pétanque'], medium:[], weak:[]},
  {n:'Championnats du Monde', strong:['mondiaux de petanque','mondiaux de pétanque','championnats du monde de petanque','championnats du monde de pétanque'], medium:[], weak:[]}
], strong:['#petanque','#pétanque','petanque','pétanque','boules lyonnaises','tir de précision pétanque','tir de precision petanque','dylan rocher','rocher pétanque','henri lacroix','philippe quintais','quintais','marco foyot'], medium:['boulodrome','carreau pétanque','cochonnet'], weak:[]});

addSpecificSport({s:'Boxe', i:'🥊', bg:'#FFF0F0', fg:'#7A1A1A', comps:[
  {n:'Championnats du Monde', strong:['championnat du monde de boxe','championnats du monde de boxe','boxing world championship'], medium:[], weak:[]},
  {n:'Combat professionnel', strong:['wbc','wba','wbo','ibf','poids lourd','poids welter','poids plume','poids leger','poids léger','poids moyen'], medium:[], weak:[]}
], strong:['#boxe','#boxing','boxe anglaise','boxe','tony yoka','estelle mossely','sofiane oumiha','mayweather','tyson fury','oleksandr usyk','anthony joshua'], medium:['ring de boxe','ko boxe','k.o. boxe','uppercut','crochet du droit'], weak:[]});

addSpecificSport({s:'Escrime', i:'🤺', bg:'#EEF2FF', fg:'#273A7A', comps:[
  {n:'Championnats du Monde', strong:['mondiaux d escrime','mondiaux d\'escrime','championnats du monde d escrime','championnats du monde d\'escrime'], medium:[], weak:[]},
  {n:'Championnats d\'Europe', strong:['euro d escrime','euro d\'escrime','championnats d europe escrime'], medium:[], weak:[]}
], strong:['#escrime','escrime','fleuret','sabre','epee escrime','épée escrime','romain cannone','manon brunet','enzo lefort','ysaora thibus','sara balzer','maxime pauty'], medium:['touche escrime','piste escrime','maitre d armes','maître d armes'], weak:[]});

addSpecificSport({s:'Triathlon', i:'🏊‍♂️', bg:'#EAF8F0', fg:'#0B5C3A', comps:[
  {n:'World Triathlon Series', strong:['world triathlon series','wts triathlon','world triathlon championship series','wtcs'], medium:[], weak:[]},
  {n:'Ironman', strong:['ironman','iron man triathlon'], medium:[], weak:[]}
], strong:['#triathlon','triathlon','cassandre beaugrand','beaugrand','leo bergere','léo bergère','bergere triathlon','bergère triathlon','vincent luis','luis triathlon','dorian coninx','coninx','emma lombardi','lombardi triathlon','pierre le corre'], medium:['natation velo course','natation vélo course','transition triathlon'], weak:[]});

addSpecificSport({s:'Canoë-Kayak', i:'🛶', bg:'#EAF7FF', fg:'#0A4A6A', comps:[
  {n:'Slalom', strong:['canoe kayak slalom','canoë kayak slalom','kayak slalom','canoe slalom','canoë slalom'], medium:[], weak:[]},
  {n:'Course en ligne', strong:['course en ligne kayak','sprint canoe','sprint kayak'], medium:[], weak:[]}
], strong:['#canoekayak','#kayak','canoe kayak','canoë kayak','canoe-kayak','canoë-kayak','kayak','nicolas gestin','gestin kayak','titouan castryck','castryck','marjorie delassus','delassus','boris neveu','neveu kayak'], medium:['eaux vives','bassin de slalom'], weak:[]});

addSpecificSport({s:'Aviron', i:'🚣', bg:'#EEF9FF', fg:'#0A4A5C', comps:[
  {n:'Championnats du Monde', strong:['mondiaux d aviron','mondiaux d\'aviron','championnats du monde d aviron','championnats du monde d\'aviron','world rowing championships'], medium:[], weak:[]}
], strong:['#aviron','#rowing','aviron','rowing','skiff','deux de couple','quatre sans barreur','huit aviron'], medium:['rameur','rameuse','barreur aviron'], weak:[]});

addSpecificSport({s:'Escalade', i:'🧗', bg:'#F5F2EA', fg:'#4A361A', comps:[
  {n:'Coupe du Monde', strong:['coupe du monde d escalade','coupe du monde d\'escalade','climbing world cup'], medium:[], weak:[]},
  {n:'Bloc / Difficulté / Vitesse', strong:['escalade de bloc','bouldering','escalade de difficulte','escalade de difficulté','speed climbing','escalade de vitesse'], medium:[], weak:[]}
], strong:['#escalade','#climbing','escalade sportive','escalade','climbing','janja garnbret','garnbret','adam ondra','ondra','oriane bertone','bertone escalade','sam avezou','avezou','mickael mawem','mickaël mawem','bassa mawem'], medium:['mur d escalade','mur d\'escalade','voie d escalade'], weak:[]});

// Extension de quelques catégories majeures avec des mots souvent présents
// dans les descriptions ou hashtags france.tv sport.
extendSport('Football', {strong:['ligue des champions uefa','uefa champions league','equipe de france espoirs','équipe de france espoirs','coupe gambardella','premiere league','premier league','la liga','serie a football','bundesliga football'], medium:['but exceptionnel','arrêt décisif foot','arret decisif foot','séance de tirs au but','seance de tirs au but']});
extendSport('Rugby', {strong:['provence rugby','stade toulousain','toulouse rugby','la rochelle rugby','racing 92','union bordeaux begles','ubb rugby','clermont rugby','montpellier rugby','rc toulon','toulon rugby'], medium:['essai transformé','essai transforme','drop rugby','mêlée rugby','melee rugby']});
extendSport('Tennis', {strong:['roland-garros 2025','roland garros 2025','roland-garros 2026','roland garros 2026'], medium:['balle de match','tie-break','tie break','court central','philippe-chatrier','suzanne-lenglen']});
extendSport('Cyclisme', {strong:['uci world tour','world tour cyclisme','tour de france femmes avec zwift'], medium:['échappée','echappee','bordure cyclisme','sprint massif','maillot jaune','maillot à pois','maillot a pois']});
extendSport('Athlétisme', {strong:['world athletics indoor','mondiaux indoor athletisme','championnats du monde indoor'], medium:['finale du 100 m','finale du 200 m','finale du 400 m','haies','relais 4x100','relais 4x400']});
extendSport('Natation', {strong:['championnats de france natation','golden tour natation'], medium:['finale du 100m nage libre','finale du 200m nage libre','finale du 400m nage libre']});

// V18 : enrichissement pour éviter les buckets génériques quand la description
// donne des indices éditoriaux ou institutionnels très fréquents.
extendSport('Football', {strong:['u17 football','u19 football','u21 football','selection espoirs football','bleuets football','coupe de france féminine','coupe de france feminine'], medium:['gardien parisien','attaquant parisien','milieu parisien','club de foot']});
extendSport('Rugby', {strong:['xv de france féminin','xv de france feminin','france rugby feminin','france rugby féminin','championnat de france de rugby'], medium:['avants du xv','trois-quarts','trois quarts','ballon ovale']});
extendSport('Tennis', {strong:['fft tennis','france tennis','open sud de france','open 13 tennis','wta strasbourg','wta rouen'], medium:['terre battue','dur indoor','service gagnant','balle de break']});
extendSport('Basket-ball', {strong:['fiba 3x3','basket 3x3','3x3 basketball','ligue féminine de basket','ligue feminine de basket','lfb basket'], medium:['ligne des trois points','lancer franc','lancers francs']});
extendSport('Handball', {strong:['ehf champions league','ligue des champions handball','d1 arkema handball','handball feminin france','handball féminin france'], medium:['jet de 7 metres','jet de 7 mètres','gardienne de hand']});
extendSport('Cyclisme', {strong:['uci women world tour','tour de l avenir','tour de l\'avenir','etoile de besseges','étoile de bessèges'], medium:['arrivée au sprint','arrivee au sprint','dernier kilometre','dernier kilomètre']});
extendSport('Athlétisme', {strong:['athle tv','fédération française d athlétisme','federation francaise d athletisme','ffa athletisme'], medium:['chrono exceptionnel','couloir 4','couloir 5','ligne droite athle']});
extendSport('Ski & Hiver', {strong:['fédération française de ski','federation francaise de ski','ffs ski','coupe du monde biathlon','ibu world cup'], medium:['dossard rouge','globe de cristal','petit globe']});

// Teste si le mot-clé est contenu dans un haystack en respectant les limites
// de mot quand le mot-clé est un mot simple. Pour les expressions multi-mots
// ou avec ponctuation, on retombe sur un includes() classique.
// Cache léger : les mots-clés sont normalisés une seule fois, puis réutilisés
// par la classification sport et france.tv.
const __KW_INFO_CACHE = new Map();
function getKwInfo(kw){
  const raw = String(kw || '');
  let info = __KW_INFO_CACHE.get(raw);
  if (info) return info;
  const n = norm(raw);
  info = {
    raw,
    n,
    isHash: n.startsWith('#'),
    needsRawIncludes: raw.startsWith(' ') || raw.endsWith(' ') || /[\s\-]/.test(n.trim()),
    hashKey: n.replace(/^#/,'').replace(/[^a-z0-9]/g,'')
  };
  __KW_INFO_CACHE.set(raw, info);
  return info;
}
function kwMatches(kw, hay){
  const info = getKwInfo(kw);
  const n = info.n;
  if (!n || !hay) return false;
  if (info.isHash) {
    let i = 0;
    while ((i = hay.raw.indexOf(n, i)) !== -1) {
      const after = hay.raw[i + n.length] || '';
      if (!/[a-z0-9_\u00C0-\u017F]/.test(after)) return true;
      i += n.length;
    }
    return false;
  }
  if (info.needsRawIncludes) return hay.raw.includes(n);
  return hay.padded.includes(' ' + n + ' ');
}

// ─── SCORING MULTI-SIGNAL ───────────────────────────────────────────────────
// Le titre reste prioritaire, la description enrichit, les tags YouTube aident
// seulement à confirmer. Les compétitions pèsent plus lourd que les termes sport.
const SRC_WEIGHTS = {
  title:       {strong:8,  medium:3,   weak:1.25, compStrong:15, compMedium:6,   compWeak:2.5},
  description: {strong:4.5,medium:1.8, weak:0.45, compStrong:9,  compMedium:3.2, compWeak:1.2},
  tags:        {strong:1.4,medium:0.4, weak:0,    compStrong:2.5,compMedium:0.8, compWeak:0}
};
const HASHTAG_BOOST = 7;
const TITLE_COMPETITION_BONUS = 6;
const GENERIC_SPORTS = new Set(['Sports Olympiques','Judo & Combat','Ski & Hiver']);
const GENERIC_OVERRIDE_MARGIN = 5; // si un sport précis est presque au même score, il gagne sur la catégorie large

function scoreKeywordList(list, hay, weight, label, matched){
  let score = 0;
  for (const kw of (list||[])) {
    if (kwMatches(kw, hay)) { score += weight; matched.push(label+':'+kw); }
  }
  return score;
}
function scoreSport(sp, sources){
  let score = 0;
  let strongSignal = false;
  let titleSignal = false;
  let compSignal = false;
  let bestComp = null, bestCompScore = 0;
  const matched = [];

  for (const sourceName of ['title','description','tags']) {
    const hay = sources[sourceName];
    const W = SRC_WEIGHTS[sourceName];

    const beforeStrong = score;
    score += scoreKeywordList(sp.strong, hay, W.strong, sourceName+'.S', matched);
    if (score > beforeStrong) { strongSignal = true; if (sourceName === 'title') titleSignal = true; }
    score += scoreKeywordList(sp.medium, hay, W.medium, sourceName+'.M', matched);
    score += scoreKeywordList(sp.weak, hay, W.weak, sourceName+'.W', matched);

    // Bonus hashtag : très fiable quand le hashtag correspond à un mot-clé sport.
    for (const kw of [...(sp.strong||[]), ...(sp.medium||[])]) {
      const k = getKwInfo(kw).hashKey;
      if (k && sources.hashtags.includes(k)) { score += HASHTAG_BOOST; strongSignal = true; matched.push('hashtag:'+kw); }
    }

    for (const c of (sp.comps||[])) {
      let cs = 0;
      cs += scoreKeywordList(c.strong, hay, W.compStrong, sourceName+'.C.S['+c.n+']', matched);
      cs += scoreKeywordList(c.medium, hay, W.compMedium, sourceName+'.C.M['+c.n+']', matched);
      cs += scoreKeywordList(c.weak, hay, W.compWeak, sourceName+'.C.W['+c.n+']', matched);
      if (sourceName === 'title' && cs >= W.compStrong) cs += TITLE_COMPETITION_BONUS;
      if (cs > 0) { compSignal = true; strongSignal = true; if (sourceName === 'title') titleSignal = true; }
      if (cs > bestCompScore) { bestCompScore = cs; bestComp = c.n; }
      score += cs;
    }
  }

  // Petite pénalité aux catégories fourre-tout quand un sport spécifique peut matcher.
  if (GENERIC_SPORTS.has(sp.s)) score *= 0.82;
  return {score, bestComp, strongSignal, titleSignal, compSignal, matched};
}

// ─── PATTERNS STRUCTURELS ────────────────────────────────────────────────────
// Cette couche matche des STRUCTURES de titres plutôt que des mots-clés isolés.
// Avantage : elle classifie correctement les futures vidéos sans qu'on doive
// enrichir une liste manuellement à chaque nouveau cycliste, ville-étape,
// club ou tournoi inconnu.
// Chaque pattern a :
//   - sport       : nom du sport ciblé (doit exister dans SR_SCORED ou les sports propres)
//   - regex       : exécutée sur le titre normalisé entouré d'espaces (' titre ')
//   - score       : points accordés au sport si la regex matche
//   - comp        : (optionnel) compétition à privilégier
//   - description : commentaire de débogage
const STRUCTURAL_PATTERNS = [

  // ── CYCLISME ────────────────────────────────────────────────────────
  // « Grand Prix de [ville] » est presque exclusivement cycliste sur FTV Sport.
  {sport:'Cyclisme', regex:/ grand prix de [a-zàâçéèêëîïôöùûüÿ-]{3,} /, score:14, desc:'Grand Prix de [ville] (cyclisme)'},
  // Formats de course propres au cyclisme.
  {sport:'Cyclisme', regex:/ course en ligne | clm individuel | contre[ -]la[ -]montre /, score:14, desc:'Format de course cycliste'},
  // Pattern « étape X » ou « le résumé de l'étape » → cyclisme (foot/rugby ne disent pas « étape »).
  {sport:'Cyclisme', regex:/ etape [0-9]| etape du jour | etape reine | l'etape | ([0-9]+e|[0-9]+er) etape /, score:12, desc:'Étape (course par étapes)'},
  // « Maillot jaune/vert/à pois/blanc » sans ambiguïté.
  {sport:'Cyclisme', regex:/ maillot (jaune|vert|a pois|à pois|blanc|rose) /, score:12, desc:'Maillot distinctif cyclisme'},
  // « cycliste / marathonien / coureur » dans le titre.
  {sport:'Cyclisme', regex:/ cycliste | cyclisme | velo | vélo | peloton /, score:9, desc:'Mention cycliste/peloton'},
  // « routes de [région] » → typique du cyclisme route.
  {sport:'Cyclisme', regex:/ routes de (bretagne|normandie|provence|france|belgique|italie|catalogne|alsace|picardie|hollande|flandres|wallonie) /, score:11, desc:'Routes de [région] (cyclisme route)'},

  // ── TENNIS ──────────────────────────────────────────────────────────
  // Niveaux de tournois ATP/WTA très distinctifs.
  {sport:'Tennis', regex:/ masters 1000 | atp 500 | atp 250 | wta 1000 | wta 500 | wta 250 /, score:14, desc:'Niveau de tournoi ATP/WTA'},
  // Métier / vocabulaire tennis exclusif.
  {sport:'Tennis', regex:/ tennisman | tenniswoman /, score:14, desc:'Métier tennis cité'},
  // Pattern « break / contre-break / balle de match / tie-break » qui n'existent que dans le tennis.
  {sport:'Tennis', regex:/ tie[- ]break | balle de break | balle de match tennis | contre[- ]break /, score:10, desc:'Vocabulaire de match de tennis'},

  // ── FOOTBALL ────────────────────────────────────────────────────────
  // Sigles de clubs de football français + noms de villes habituels.
  // Les sigles FC / AS / RC / SC / OM / OL / OGC / ASM / RCS / RCSA / SCO / OGCN sont quasi exclusifs au foot.
  // Note : on accepte tous les apostrophes (' et ’) car la normalisation en a fait des '.
  {sport:'Football', regex:/ (fc|ac|as|rc|sc|sm|om|ol|ogc|asse|asm|rcs|rcsa|sco|ogcn|estac|tfc|losc|fcgb|fcn) [a-zàâçéèêëîïôöùûüÿ'-]{3,}/i, score:13, desc:'Sigle de club de football + ville'},
  // Patterns « match de préparation », « match amical » ne sont quasi qu'en foot/rugby. On donne au foot par défaut.
  {sport:'Football', regex:/ match de preparation | match amical | match de qualification | match retour /, score:8, desc:'Phase de match (préparation/amical)'},
  // Vocabulaire technique foot.
  {sport:'Football', regex:/ coup franc | corner | penalty | hors[- ]jeu | carton (jaune|rouge) | tete decisive /, score:8, desc:'Vocabulaire football'},
  // « arbitre(s) de foot/football » est un signal explicite sport.
  {sport:'Football', regex:/ arbitres? de (foot|football) | violences dans le football | violences dans le foot | football francais | football français | football feminin | football féminin | football amateur | football professionnel /, score:13, desc:'Mention foot explicite + contexte'},
  // « football » seul mérite un score plus élevé que 1pt (sport très commun mais distinctif).
  {sport:'Football', regex:/ football | footballeur | footballeuse /, score:6, desc:'Football mentionné'},

  // ── RUGBY ───────────────────────────────────────────────────────────
  // Termes propres au rugby.
  {sport:'Rugby', regex:/ essai (transforme|de penalite|en coin|collectif) | drop[- ]goal | melee | mêlée | maul | regroupement /, score:13, desc:'Vocabulaire rugby'},
  // « XV » suivi d'un nom (XV de France, XV du Poireau…) — sigle exclusif rugby.
  {sport:'Rugby', regex:/ xv (de|du|d') /, score:14, desc:'XV de [équipe]'},
  // Mentions de rochelais/toulousains/parisiens/lyonnais + match/score → rugby (Top 14).
  {sport:'Rugby', regex:/ rochelais | toulousains | parisiens (rugby| ruby) | lyonnais (rugby| ruby) | bordelais rugby | clermontois | montpellierains /, score:8, desc:'Supporters de clubs de rugby'},

  // ── ATHLÉTISME ──────────────────────────────────────────────────────
  // Distances de course (m / km) avec finale, record, etc.
  {sport:'Athlétisme', regex:/ (100|200|400|800|1500|3000|5000|10000) ?m (haies|hommes|dames|femmes|messieurs|en )/, score:14, desc:'Distance + catégorie athlé'},
  // « Marathon de [ville] » + nom propre → marathon.
  {sport:'Athlétisme', regex:/ marathon de [a-zàâçéèêëîïôöùûüÿ-]{3,} /, score:13, desc:'Marathon de [ville]'},
  // Mots-clés sauts/lancers.
  {sport:'Athlétisme', regex:/ saut (en hauteur|en longueur|a la perche|à la perche) | triple saut | lancer (du poids|du javelot|du disque|du marteau) /, score:14, desc:'Discipline athlé technique'},
  // Pattern « 2e marathon de sa vie », « son marathon », etc.
  {sport:'Athlétisme', regex:/ marathon de sa vie | son (premier|deuxieme|deuxième|2e|3e) marathon | marathonien | marathonienne /, score:11, desc:'Récit marathon / coureur'},
  // Pattern « X km hommes/femmes » courant dans les nouvelles disciplines (semi, trail).
  {sport:'Athlétisme', regex:/ ([0-9]+) ?km (hommes|dames|femmes|messieurs|en )/, score:10, desc:'Course longue distance'},

  // ── TRAIL / ULTRA (sous athlétisme via comp) ────────────────────────
  {sport:'Athlétisme', regex:/ trail | ultra[- ]trail | ultra trail | utmb | diagonale des fous /, score:13, comp:'Trail & Ultra-trail', desc:'Trail running'},

  // ── NATATION ────────────────────────────────────────────────────────
  {sport:'Natation', regex:/ (50|100|200|400|800|1500) ?m (nage libre|dos|brasse|papillon|4 nages|4nages|hommes|dames) /, score:14, desc:'Distance + nage'},
  {sport:'Natation', regex:/ relais 4x(50|100|200) | (4 nages|4nages) (individuel|relais) /, score:12, desc:'Relais ou 4 nages'},
  {sport:'Natation', regex:/ bassin de [0-9]{2}m | en bassin /, score:10, desc:'Bassin de natation'},

  // ── BASKET ──────────────────────────────────────────────────────────
  {sport:'Basket-ball', regex:/ ([0-9]+) points | triple double | dunk /, score:8, desc:'Stats / actions basket'},
  {sport:'Basket-ball', regex:/ (lakers|celtics|warriors|spurs|knicks|nuggets|heat|bulls|nets|sixers|raptors|mavericks|suns|jazz|grizzlies|thunder|wolves|pelicans|kings|magic|hawks|hornets|pistons|cavaliers|wizards|trail blazers|clippers|rockets|pacers|bucks|76ers) /, score:14, desc:'Franchise NBA'},

  // ── HANDBALL ────────────────────────────────────────────────────────
  {sport:'Handball', regex:/ (les experts|les bleues du hand) | demi[- ]centre | aile gauche | aile droite | arriere (gauche|droit|gauche|central) handball /, score:11, desc:'Vocabulaire handball'},

  // ── HOCKEY SUR GLACE ────────────────────────────────────────────────
  {sport:'Hockey sur glace', regex:/ (canadiens|maple leafs|bruins|rangers|capitals|penguins|flyers|red wings|oilers|flames|kings|sharks|stars|blackhawks|avalanche|golden knights|coyotes|panthers|lightning|jets|senators|sabres|hurricanes|blue jackets|predators|wild|ducks) /, score:14, desc:'Franchise NHL'},

  // ── F1 / SPORTS MOTEURS ─────────────────────────────────────────────
  {sport:'Sports Moteurs', regex:/ pole position | tour le plus rapide | grille de depart | grille de départ | pilote (de )?(formule 1|formula 1|f1|motogp|moto gp|rallye|wrc) | copilote (de )?(rallye|wrc) /, score:11, desc:'Vocabulaire F1/MotoGP/rallye'},
  // Copilotes rallye français (Mathieu Baumel = co-pilote de Sébastien Loeb).
  {sport:'Sports Moteurs', regex:/ mathieu baumel | baumel rallye | daniel elena | elena rallye | jonathan toumire | nicolas gilsoul | gilsoul rallye | scott martin /, score:13, desc:'Copilotes rallye'},
  // Une regex spécifique « gp explorer / gpexplorer » vu sur les captures (e-sport / event amateur).
  {sport:'E-sport', regex:/ gp explorer | gpexplorer | #gpexplorer /, score:14, desc:'GP Explorer (event)'},

  // ── SKI / HIVER ─────────────────────────────────────────────────────
  // Disciplines très spécifiques (avec et sans tiret/espace).
  {sport:'Ski & Hiver', regex:/ ski[- ]?alpinisme | ski alpinisme | ski[- ]de[- ]rando | ski de randonnee | ski de randonnée | descente messieurs | descente hommes ski | super[- ]g | slalom geant | slalom géant | combine alpin /, score:13, desc:'Discipline ski'},
  // Légendes du ski français (champions olympiques pas tous dans nos listes).
  {sport:'Ski & Hiver', regex:/ grospiron | killy | lamy chappuis | jean[- ]baptiste grange | luc alphand | carole montillet /, score:12, desc:'Légendes ski FR'},

  // ── ALPINISME (nouveau, on classe en Athlétisme/outdoor faute de sport propre) ──
  {sport:'Athlétisme', regex:/ himalaya | annapurna | everest | k2 | makalu | manaslu | dhaulagiri | nanga parbat | gasherbrum | broad peak | 8000 metres | 8000 mètres | 8 000 m d'altitude | sommet de l'himalaya /, score:12, comp:'Trail & Ultra-trail', desc:'Alpinisme/haute montagne'},

  // ── COURSE CAMARGUAISE / TAUROMACHIE → traité comme Sport Olympiques ──
  {sport:'Sports Olympiques', regex:/ course camarguaise | raseteur | course landaise | encierro /, score:11, desc:'Sports taurins / camarguais'},

  // ── LUTTE / KUSHTI / SPORTS DE COMBAT TRADITIONNELS ─────────────────
  {sport:'Judo & Combat', regex:/ kushti | sumo | sambo | krav maga | jiu[- ]jitsu | bjj | grappling | pancrace | pankration /, score:13, desc:'Sports de combat traditionnels'},

  // ── SURF (renforcement) ─────────────────────────────────────────────
  {sport:'Surf', regex:/ vague (de|du|de la) [a-zàâçéèêëîïôöùûüÿ-]{3,} | spot de surf | session de surf | la nord (a |de )/, score:12, desc:'Vague de [lieu]'},

  // ── PATINAGE (renforcement) ─────────────────────────────────────────
  {sport:'Ski & Hiver', regex:/ couple de patineurs | duo de patineurs | quadruple (boucle|toe[- ]loop|axel|salchow|lutz|flip) | triple (axel|lutz|salchow|flip|toe[- ]loop|boucle) /, score:13, comp:'Patinage', desc:'Vocabulaire patinage artistique'},

  // ── PATTERNS FÉMININ / MASCULIN ─────────────────────────────────────
  // Pattern « (F) » dans titre signe quasi sûr d'un événement féminin du même sport.
  // Pas de sport ici : c'est juste un boost mineur transverse (utilisé ailleurs).
];

// Applique les patterns structurels et retourne {scores, matched, compHints}
// scores : Map sport → points
// compHints : Map sport → comp suggérée
function applyStructuralPatterns(sources){
  // On normalise le haystack pour les regex : la ponctuation (parenthèses,
  // virgules, points, etc.) est remplacée par des espaces de manière à ce que
  // tous nos patterns « ' xxx ' » matchent uniformément, y compris quand le
  // mot-clé est en bord de ponctuation comme « (ski-alpinisme) » ou « Kushti, ».
  const rawTitle = sources.title.raw + ' ' + (sources.description?.raw || '');
  // On garde tirets (utiles pour patterns comme « ski-alpinisme »), on remplace
  // tout le reste de la ponctuation (parenthèses, virgules, apostrophes…) par
  // des espaces. Cela permet à « l'AC Ajaccio » → « l ac ajaccio » de matcher
  // une regex « (fc|ac|...) [ville] ».
  const haystack = ' ' + rawTitle.replace(/[(){}\[\],.;:!?"«»…\n\r\t''‛`]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const scores = {};
  const matched = {};
  const compHints = {};
  for (const p of STRUCTURAL_PATTERNS) {
    if (p.regex.test(haystack)) {
      scores[p.sport] = (scores[p.sport] || 0) + p.score;
      if (!matched[p.sport]) matched[p.sport] = [];
      matched[p.sport].push('struct:' + p.desc);
      if (p.comp && !compHints[p.sport]) compHints[p.sport] = p.comp;
    }
  }
  return {scores, matched, compHints};
}

function inferVideoCategoryFromText(sources){
  const text = sources.all.raw;
  const title = sources.title.raw;
  const has = (...arr) => arr.some(x => title.includes(norm(x)) || text.includes(norm(x)));

  // V18 : plus de libellé visible du type « Sports généralistes » ou « Contenu sport général ».
  // Si le sport reste incertain, on classe quand même la vidéo dans une famille
  // éditoriale utile : résumé, replay, actu, portrait, émission, direct, etc.
  if (has('résumé','resume','highlights','temps forts','meilleurs moments','top actions','top 5','top 10','best of','best-of')) return 'Résumé / temps forts';
  if (has('replay','intégralité','integralite','match complet','course complète','course complete','en intégralité','en integralite')) return 'Replay / intégralité';
  if (has('interview','réaction','reaction','conférence de presse','conference de presse','au micro','déclaration','declaration','répond','repond')) return 'Interview / réaction';
  if (has('extrait','séquence','sequence','incroyable','exceptionnel','but','essai','chute','crash','finish','sprint final','action décisive','action decisive','exploit','record')) return 'Extrait / moment fort';
  if (has('portrait','reportage','dans les coulisses','inside','immersion','histoire de','portrait de','documentaire','feuilleton')) return 'Reportage / portrait';
  if (has('calendrier','programme','tirage','liste','sélection','selection','annonce','officiel','officielle','résultat','resultat','classement','tableau','convocation')) return 'Actualité / annonce';
  if (has('stade 2','tout le sport','tls','magazine','le mag','plateau','émission','emission','débat','debat')) return 'Magazine / émission';
  if (has('live','direct','en direct','avant-match','après-match','apres-match')) return 'Direct / live';
  if (has('shorts','#shorts','short')) return 'Shorts';
  return 'Contenu sport général';
}

function fallbackBucket(best, second, sources, category){
  const bestScore = best?.score || 0;
  const secondScore = second?.score || 0;
  const closeScores = bestScore > 0 && secondScore > 0 && Math.abs(bestScore - secondScore) <= 2.5;

  // Cas 1 : deux sports plausibles ont des scores proches. On ne force pas un mauvais choix.
  if (closeScores && best?.sp?.s && second?.sp?.s && best.sp.s !== second.sp.s) {
    return {
      s:'Multi-sports',
      c: category,
      bg:'#F0F7FF',
      fg:'#1B4D7A',
      i:'🏅',
      _debug:{confidence:'multi_sport', score:bestScore, second:secondScore, candidates:[best.sp.s, second.sp.s], kws:[...(best.matched||[]), ...(second.matched||[])]}
    };
  }

  // Cas 2 : le sport n'est pas assez fiable, mais le type éditorial de vidéo l'est.
  return {
    s:'Sports généralistes',
    c: category,
    bg:'#F5F7FA',
    fg:'#344054',
    i:'🏟️',
    _debug:{confidence:'editorial_fallback', score:bestScore, second:secondScore, candidate:best?.sp?.s||null, kws:best?.matched||[], reason:'sport_signal_too_weak'}
  };
}

function confidenceLabel(bestScore, secondScore, best){
  if (!best || bestScore <= 0) return 'fallback';
  const gap = bestScore - secondScore;
  if (best.compSignal || bestScore >= 18 || (best.titleSignal && gap >= 3)) return 'high';
  if (bestScore >= 7 && gap >= 2) return 'medium';
  return 'low';
}

window.classify = function(input, tags=[], description='') {
  const sources = buildSearchSources(input, tags, description);

  const titleLock = applyTitleSportLock(sources);
  if (titleLock) return titleLock;

  // 1. Couche STRUCTURELLE : on applique d'abord les patterns regex qui
  // matchent des structures de titres (« course en ligne », « Grand Prix de [ville] »,
  // « Masters 1000 », sigles de clubs FC/AS/RC, distances athlétiques, etc.).
  // Ces patterns produisent un score additionnel par sport.
  const struct = applyStructuralPatterns(sources);


  // 2. Couche MOTS-CLÉS : scoring classique sur titre/description/tags via SR_SCORED.
  let best = null, second = null;
  for (const sp of window.SR_SCORED) {
    const r = scoreSport(sp, sources);
    // Fusion : on additionne le score structurel au score mots-clés.
    if (struct.scores[sp.s]) {
      r.score += struct.scores[sp.s];
      r.matched = [...(r.matched||[]), ...(struct.matched[sp.s]||[])];
      // Un match structurel compte comme un signal fort (la regex est volontairement spécifique).
      r.strongSignal = true;
      r.titleSignal = true;
      // Si le pattern suggère une compétition et qu'on n'en a pas trouvé via mots-clés,
      // on l'utilise. Sinon on garde celle des mots-clés (plus précise).
      if (!r.bestComp && struct.compHints[sp.s]) {
        r.bestComp = struct.compHints[sp.s];
        r.compSignal = true;
      }
    }
    const item = {sp, ...r};
    if (!best || item.score > best.score) { second = best; best = item; }
    else if (!second || item.score > second.score) second = item;
  }

  if (best && second && GENERIC_SPORTS.has(best.sp.s) && !GENERIC_SPORTS.has(second.sp.s) && (best.score - second.score) <= GENERIC_OVERRIDE_MARGIN) {
    const tmp = best; best = second; second = tmp;
  }
  const secondScore = second?.score || 0;
  const conf = confidenceLabel(best?.score||0, secondScore, best);

  // Si le signal sport est faible, on ne crée plus de catégorie visible floue.
  // La vidéo est rangée dans un bucket éditorial propre : Sports généralistes ou Multi-sports.
  if (!best || conf === 'fallback' || (conf === 'low' && !best.strongSignal)) {
    const cat = inferVideoCategoryFromText(sources);
    return fallbackBucket(best, second, sources, cat);
  }

  // En cas d'égalité, on choisit le sport spécifique plutôt qu'une catégorie générique.
  if (best && second && Math.abs(best.score - second.score) < 0.01) {
    if (GENERIC_SPORTS.has(best.sp.s) && !GENERIC_SPORTS.has(second.sp.s)) best = second;
  }

  return {
    s: best.sp.s,
    c: best.bestComp || inferVideoCategoryFromText(sources),
    bg: best.sp.bg,
    fg: best.sp.fg,
    i: best.sp.i,
    _debug:{confidence:conf, score:best.score, second:secondScore, kws:best.matched, comp:best.bestComp||null}
  };
};



// ─── CLASSIFICATION GÉNÉRALISTE POUR LA CHAÎNE @francetv ───────────────────
// Le moteur sport existant est conservé tel quel. Ce second moteur ne s'active
// que pour les vidéos dont channelKey === 'francetv'.
window.classifySport = window.classify;

window.FTV_GENERAL_SCORED = [
  {s:'Actualité & société', i:'📰', bg:'#EEF4FF', fg:'#1A3A6A', comps:[
    {n:'C dans l’air', strong:['c dans l air','c dans l’air','cdanslair','caroline roux'], medium:[], weak:[]},
    {n:'C à vous / C l’hebdo', strong:['c a vous','c à vous','c l hebdo','c l’hebdo','anne-elisabeth lemoine','anne élisabeth lemoine','bertrand chameroy','patrick cohen'], medium:[], weak:[]},
    {n:'Télématin', strong:['telematin','télématin','telematin replay','télématin replay','maya lauqué','thomas sotto'], medium:[], weak:[]},
    {n:'Journaux télévisés', strong:['journal de 20h','journal de 13h','jt 20h','jt 13h','20 heures','13 heures','le 20h','le 13h'], medium:['edition du soir','édition du soir'], weak:[]},
    {n:'Politique', strong:['politique','gouvernement','assemblee nationale','assemblée nationale','senat','sénat','elysee','elysée','emmanuel macron','macron','premier ministre','matignon','ministre','elections','élections','presidentielle','présidentielle','legislatives','législatives','municipales','europeennes','européennes','vote','scrutin'], medium:['depute','député','senateur','sénateur','campagne electorale','campagne électorale'], weak:[]},
    {n:'International', strong:['international','ukraine','russie','gaza','israel','israël','palestine','etats-unis','états-unis','donald trump','joe biden','chine','europe','union europeenne','union européenne','otan','onu','afrique','moyen-orient'], medium:['guerre','conflit','diplomatie','frontiere','frontière','crise internationale'], weak:[]},
    {n:'Justice / faits divers', strong:['justice','proces','procès','tribunal','cour d assises','cour d\'assises','condamne','condamné','enquete','enquête','police','gendarmerie','faits divers','meurtre','disparition','agression','violences','arrestation'], medium:['plainte','victime','suspect','audience','avocat','magistrat'], weak:[]},
    {n:'Économie / consommation', strong:['economie','économie','inflation','pouvoir d achat','pouvoir d\'achat','prix','salaire','emploi','chomage','chômage','impots','impôts','budget','entreprise','consommation','arnaque','immobilier','retraite'], medium:['supermarche','supermarché','carburant','taxe','banque','assurance'], weak:[]},
    {n:'Climat / environnement', strong:['climat','rechauffement climatique','réchauffement climatique','environnement','ecologie','écologie','pollution','secheresse','sécheresse','inondations','canicule','biodiversite','biodiversité','energie','énergie','agriculture'], medium:['meteo extreme','météo extrême','transition ecologique','transition écologique'], weak:[]},
    {n:'Santé', strong:['sante','santé','hopital','hôpital','medecin','médecin','maladie','epidemie','épidémie','vaccin','covid','cancer','addiction','handicap','psychiatrie','depression','dépression'], medium:['soins','patient','symptomes','symptômes','urgence medicale','urgence médicale'], weak:[]},
    {n:'Météo / catastrophes', strong:['meteo','météo','tempete','tempête','orage','neige','pluie','vigilance orange','vigilance rouge','incendie','feu de forêt','feu de foret','catastrophe naturelle'], medium:['rafales','crue','intemperies','intempéries'], weak:[]},
  ], strong:['#actualite','#actualité','#franceinfo','franceinfo','journal de 20h','journal de 13h','jt 20h','jt 13h','20 heures','13 heures','info','infos','actualite','actualité','societe','société'], medium:['reportage','enquete','enquête','temoignage','témoignage','decryptage','décryptage','edition speciale','édition spéciale'], weak:['news']},

  {s:'Documentaires & enquêtes', i:'🎬', bg:'#F4F0FA', fg:'#4A2A7A', comps:[
    {n:'Envoyé spécial', strong:['envoye special','envoyé spécial','#envoyespecial'], medium:[], weak:[]},
    {n:'Complément d’enquête', strong:['complement d enquete','complément d\'enquête','complément d’enquête','complement d\'enquete','#complementdenquete'], medium:[], weak:[]},
    {n:'Cash Investigation', strong:['cash investigation','elise lucet','élise lucet'], medium:[], weak:[]},
    {n:'Des racines et des ailes', strong:['des racines et des ailes'], medium:[], weak:[]},
    {n:'Thalassa', strong:['thalassa','faut pas rever','faut pas rêver'], medium:[], weak:[]},
    {n:'Secrets d’histoire', strong:['secrets d histoire','secrets d’histoire','stephane bern','stéphane bern'], medium:[], weak:[]},
    {n:'Infrarouge', strong:['infrarouge'], medium:[], weak:[]},
    {n:'13h15', strong:['13h15','13 h 15','13h15 le samedi','13h15 le dimanche'], medium:[], weak:[]},
    {n:'Le monde en face', strong:['le monde en face'], medium:[], weak:[]},
    {n:'Apocalypse / Histoire', strong:['apocalypse','seconde guerre mondiale','premiere guerre mondiale','première guerre mondiale','histoire de france','archives','documentaire historique'], medium:['histoire','historique'], weak:[]},
    {n:'Société / enquête', strong:['documentaire','enquête exclusive','investigation','les docs','temoignages','témoignages'], medium:['immersion','dans les coulisses','coulisses'], weak:[]},
  ], strong:['documentaire','docu','investigation','enquete','enquête','reportage long format','#documentaire','#docs'], medium:['portrait','immersion','temoignage','témoignage','archives','feuilleton documentaire'], weak:[]},

  {s:'Séries & fictions', i:'🎭', bg:'#FFF0F3', fg:'#8A1D3A', comps:[
    {n:'Un si grand soleil', strong:['un si grand soleil','usgs'], medium:[], weak:[]},
    {n:'Plus belle la vie', strong:['plus belle la vie','pblv','plus belle la vie encore plus belle'], medium:[], weak:[]},
    {n:'Astrid et Raphaëlle', strong:['astrid et raphaelle','astrid et raphaëlle'], medium:[], weak:[]},
    {n:'Ici tout commence / Demain nous appartient', strong:['ici tout commence','demain nous appartient'], medium:[], weak:[]},
    {n:'La Stagiaire', strong:['la stagiaire','michèle bernier','michele bernier'], medium:[], weak:[]},
    {n:'Capitaine Marleau', strong:['capitaine marleau','marleau'], medium:[], weak:[]},
    {n:'Meurtres à...', strong:['meurtres a','meurtres à','meurtres en','meurtres au','meurtres dans'], medium:[], weak:[]},
    {n:'Alex Hugo', strong:['alex hugo'], medium:[], weak:[]},
    {n:'OPJ', strong:['opj pacifique sud','opj'], medium:[], weak:[]},
    {n:'L’art du crime', strong:['l art du crime','l\'art du crime','l’art du crime'], medium:[], weak:[]},
    {n:'Tandem / Cassandre', strong:['tandem','cassandre','cesar wagner','césar wagner','simon coleman'], medium:[], weak:[]},
  ], strong:['serie','série','fiction','telefilm','téléfilm','episode','épisode','saison','bande-annonce fiction','extrait fiction'], medium:['comedien','comédien','actrice','acteur','personnage','intrigue'], weak:[]},

  {s:'Divertissement & jeux', i:'🎤', bg:'#FFF6E8', fg:'#8A4D00', comps:[
    {n:'N’oubliez pas les paroles', strong:['n oubliez pas les paroles','n\'oubliez pas les paroles','n’oubliez pas les paroles','noplp','maestro'], medium:[], weak:[]},
    {n:'Fort Boyard', strong:['fort boyard','pere fouras','père fouras','boyard'], medium:[], weak:[]},
    {n:'Drag Race France', strong:['drag race france','drag race'], medium:[], weak:[]},
    {n:'Eurovision', strong:['eurovision','eurovision song contest'], medium:[], weak:[]},
    {n:'Taratata', strong:['taratata'], medium:[], weak:[]},
    {n:'Quelle époque !', strong:['quelle epoque','quelle époque','lea salame','léa salamé','christophe dechavanne'], medium:[], weak:[]},
    {n:'La boîte à secrets', strong:['la boite a secrets','la boîte à secrets'], medium:[], weak:[]},
    {n:'Affaire conclue', strong:['affaire conclue','sophie davant','julia vignali'], medium:[], weak:[]},
    {n:'Slam / Questions pour un champion', strong:['slam','questions pour un champion','qpu c','qpu c','cyril feraud','cyril féraud','samuel etienne','samuel étienne'], medium:[], weak:[]},
    {n:'Ça commence aujourd’hui', strong:['ca commence aujourd hui','ça commence aujourd’hui','ça commence aujourd hui','faustine bollaert'], medium:[], weak:[]},
    {n:'Jeux TV', strong:['jeu tv','quiz','candidat','finale du jeu','champion du jeu','the floor','100% logique','tout le monde veut prendre sa place'], medium:['plateau','animateur','animatrice'], weak:[]},
  ], strong:['divertissement','jeu','emission','émission','plateau','humour','sketch','animateur','animatrice','prime','prime time','#divertissement'], medium:['candidat','finale','best of','coulisses'], weak:[]},

  {s:'Culture & musique', i:'🎼', bg:'#F0FAF6', fg:'#0F5C3F', comps:[
    {n:'Musique / concerts', strong:['concert','musique','chanson','chanteur','chanteuse','festival de musique','orchestre','symphonique','opera','opéra','taratata'], medium:['live musical','session live'], weak:[]},
    {n:'La grande librairie', strong:['la grande librairie','augustin trapenard'], medium:[], weak:[]},
    {n:'Passage des arts', strong:['passage des arts','claire chazal'], medium:[], weak:[]},
    {n:'Cinéma', strong:['cinema','cinéma','film','festival de cannes','cannes','cesar','césar','acteur','actrice','realisateur','réalisateur'], medium:['tournage','avant-premiere','avant-première'], weak:[]},
    {n:'Littérature / arts', strong:['livre','roman','litterature','littérature','auteur','autrice','bande dessinee','bande dessinée','exposition','musee','musée','theatre','théâtre'], medium:['artiste','oeuvre','œuvre'], weak:[]},
    {n:'Patrimoine', strong:['patrimoine','monument','chateau','château','cathedrale','cathédrale','des racines et des ailes'], medium:['histoire locale','terroir'], weak:[]},
  ], strong:['culture','musique','cinema','cinéma','festival','art','theatre','théâtre','livre','patrimoine'], medium:['artiste','scene','scène','spectacle','exposition'], weak:[]},

  {s:'Jeunesse & éducation', i:'🧸', bg:'#F0F8FF', fg:'#0A4A7A', comps:[
    {n:'Okoo', strong:['okoo','#okoo','les zinzins de l espace','les zinzins de l’espace','bluey','peppa pig','sam le pompier'], medium:[], weak:[]},
    {n:'Lumni', strong:['lumni','lumni enseignement','lumni education','lumni éducation'], medium:[], weak:[]},
    {n:'Dessins animés', strong:['dessin animé','dessins animés','animation jeunesse','tchoupi','t\'choupi','peppa pig','sam le pompier','simon superlapin','les as de la jungle','masha et michka'], medium:['episode enfant','épisode enfant'], weak:[]},
    {n:'Éducation / scolaire', strong:['education','éducation','ecole','école','college','collège','lycee','lycée','bac','brevet','revisions','révisions'], medium:['professeur','cours','apprendre'], weak:[]},
  ], strong:['jeunesse','enfant','enfants','okoo','lumni','dessin animé','dessins animés','animation'], medium:['famille','apprendre','educatif','éducatif'], weak:[]},

  {s:'Lifestyle & quotidien', i:'🏡', bg:'#F7F3EA', fg:'#5A4010', comps:[
    {n:'Les maternelles', strong:['la maison des maternelles','les maternelles','maternelles','agathe lecarnier'], medium:[], weak:[]},
    {n:'Cuisine', strong:['cuisine','recette','chef','plat','patisserie','pâtisserie','gâteau','gateau','ingredient','ingrédient','marmiton'], medium:['cuisson','four','restaurant'], weak:[]},
    {n:'Maison / jardin', strong:['silence ca pousse','silence ça pousse','jardin','jardinage','plante','maison','deco','déco','decoration','décoration'], medium:['bricolage','amenagement','aménagement'], weak:[]},
    {n:'Santé / bien-être', strong:['la maison des maternelles','maternelles','bien-être','bien etre','psychologie','sommeil','nutrition','parentalite','parentalité'], medium:['famille','couple','enfant'], weak:[]},
    {n:'Voyage / découverte', strong:['echappees belles','échappées belles','voyage','destination','decouverte','découverte','road trip','week-end','week end'], medium:['tourisme','itineraire','itinéraire'], weak:[]},
    {n:'Météo à la carte', strong:['meteo a la carte','météo à la carte'], medium:[], weak:[]},
  ], strong:['lifestyle','quotidien','cuisine','maison','jardin','voyage','famille','maternelles','bien-être','bien etre'], medium:['astuce','conseil','conseils','pratique'], weak:[]},

  {s:'Sport', i:'🏅', bg:'#FFF8E1', fg:'#7A6000', comps:[
    {n:'Jeux olympiques / paralympiques', strong:['jeux olympiques','jeux paralympiques','paris 2024','jo 2024','jo de paris','paralympiques'], medium:[], weak:[]},
    {n:'Football', strong:['football','ligue 1','coupe de france','equipe de france de football','équipe de france de football','mbappe','mbappé'], medium:['foot'], weak:[]},
    {n:'Rugby', strong:['rugby','xv de france','six nations','top 14'], medium:[], weak:[]},
    {n:'Tennis', strong:['tennis','roland-garros','roland garros','wimbledon'], medium:[], weak:[]},
    {n:'Cyclisme', strong:['cyclisme','tour de france','velo','vélo'], medium:[], weak:[]},
    {n:'Autres sports', strong:['basket','handball','natation','athletisme','athlétisme','judo','biathlon','ski','volley'], medium:[], weak:[]},
  ], strong:['sport','sports','#sport','#sports','match','competition sportive','compétition sportive'], medium:['athlete','athlète','champion','championne','finale sportive'], weak:[]},

  {s:'Outre-mer & régions', i:'🗺️', bg:'#EEF9F5', fg:'#12614A', comps:[
    {n:'Outre-mer', strong:['outre-mer','outre mer','guadeloupe','martinique','guyane','reunion','réunion','mayotte','polynesie','polynésie','nouvelle-caledonie','nouvelle-calédonie'], medium:[], weak:[]},
    {n:'Régions', strong:['regions','régions','france 3 regions','france 3 régions','bretagne','normandie','occitanie','provence','alsace','corse','nouvelle-aquitaine','hauts-de-france'], medium:['local','territoire'], weak:[]},
  ], strong:['outre-mer','outre mer','regions','régions','france 3 region','france 3 région'], medium:['territoire','local'], weak:[]},

  {s:'Bandes-annonces & extraits', i:'▶️', bg:'#F5F5F5', fg:'#344054', comps:[
    {n:'Bande-annonce', strong:['bande-annonce','bande annonce','teaser','trailer','prochainement'], medium:[], weak:[]},
    {n:'Extrait', strong:['extrait','extrait exclusif','sequence','séquence','scene','scène'], medium:[], weak:[]},
    {n:'Replay / épisode', strong:['replay','episode complet','épisode complet','integralite','intégralité','en streaming'], medium:['episode','épisode'], weak:[]},
    {n:'Best-of / moments forts', strong:['best of','best-of','temps forts','meilleurs moments','top 5','top 10'], medium:[], weak:[]},
  ], strong:['bande-annonce','bande annonce','teaser','trailer','extrait','replay','episode','épisode'], medium:['prochainement','nouveau programme'], weak:[]},
];

function detectGeneralFormat(sources){
  const text = sources.all.raw;
  const title = sources.title.raw;
  const has = (...arr) => arr.some(x => title.includes(norm(x)) || text.includes(norm(x)));
  if (has('bande-annonce','bande annonce','teaser','trailer','prochainement')) return 'Bande-annonce';
  if (has('replay','episode complet','épisode complet','integralite','intégralité','en streaming')) return 'Replay / épisode';
  if (has('extrait','sequence','séquence','scene','scène')) return 'Extrait';
  if (has('interview','reaction','réaction','au micro','invite','invité','invitée')) return 'Interview / plateau';
  if (has('best of','best-of','temps forts','meilleurs moments','top 5','top 10')) return 'Best-of';
  if (has('live','direct','en direct')) return 'Direct';
  return null;
}

function inferGeneralFallbackCategory(sources){
  const text = sources.all.raw;
  const title = sources.title.raw;
  const has = (...arr) => arr.some(x => title.includes(norm(x)) || text.includes(norm(x)));
  if (has('bande-annonce','bande annonce','teaser','trailer','prochainement')) return {s:'Bandes-annonces & extraits', c:'Bande-annonce'};
  if (has('extrait','sequence','séquence','scene','scène')) return {s:'Bandes-annonces & extraits', c:'Extrait'};
  if (has('replay','episode','épisode','integralite','intégralité')) return {s:'Bandes-annonces & extraits', c:'Replay / épisode'};
  if (has('interview','reaction','réaction','au micro','invite','invité','invitée')) return {s:'Divertissement & jeux', c:'Interview / plateau'};
  if (has('documentaire','reportage','enquete','enquête','immersion')) return {s:'Documentaires & enquêtes', c:'Société / enquête'};
  if (has('journal','jt','actualite','actualité','franceinfo','20h','13h')) return {s:'Actualité & société', c:'Actualité générale'};
  if (has('serie','série','fiction','telefilm','téléfilm')) return {s:'Séries & fictions', c:'Autres fictions'};
  if (has('emission','émission','plateau','jeu','divertissement')) return {s:'Divertissement & jeux', c:'Autres émissions'};
  return {s:'Bandes-annonces & extraits', c:'Extrait'};
}

function themeMeta(name){
  return window.FTV_GENERAL_SCORED.find(t => t.s === name) || {s:name,i:'📺',bg:'#F5F7FA',fg:'#344054'};
}

const FTV_GENERAL_PROGRAM_COMPS = new Set([
  'Envoyé spécial','Complément d’enquête','Cash Investigation','Infrarouge','13h15','Le monde en face',
  'Un si grand soleil','Plus belle la vie','Astrid et Raphaëlle','Capitaine Marleau','Alex Hugo','OPJ','L’art du crime','Tandem / Cassandre',
  'N’oubliez pas les paroles','Fort Boyard','Drag Race France','Eurovision','Taratata','Quelle époque !','La boîte à secrets',
  'Okoo','Lumni','Météo à la carte','C dans l’air','C à vous / C l’hebdo','Télématin','Journaux télévisés','Des racines et des ailes','Thalassa','Secrets d’histoire','Ici tout commence / Demain nous appartient','La Stagiaire','Affaire conclue','Slam / Questions pour un champion','Ça commence aujourd’hui','La grande librairie','Passage des arts','Les maternelles'
]);

window.classifyGeneral = function(input, tags=[], description='') {
  const sources = buildSearchSources(input, tags, description);
  let best = null, second = null;
  for (const theme of window.FTV_GENERAL_SCORED) {
    const r = scoreSport(theme, sources);
    const item = {sp:theme, ...r};
    // Les noms d'émissions/programmes exacts doivent primer sur les mots génériques
    // de l'actualité ou de la société présents dans le même titre.
    if (item.bestComp && FTV_GENERAL_PROGRAM_COMPS.has(item.bestComp)) item.score += 38;
    if (!best || item.score > best.score) { second = best; best = item; }
    else if (!second || item.score > second.score) second = item;
  }
  const secondScore = second?.score || 0;
  const formatHint = detectGeneralFormat(sources);
  const gap = (best?.score || 0) - secondScore;
  const strongEnough = best && (best.compSignal || best.titleSignal || best.score >= 6 || gap >= 2.5);
  if (!strongEnough) {
    const fb = inferGeneralFallbackCategory(sources);
    const meta = themeMeta(fb.s);
    return {s:meta.s, c:fb.c, bg:meta.bg, fg:meta.fg, i:meta.i,
      _debug:{confidence:'fallback_general', score:best?.score||0, second:secondScore, candidate:best?.sp?.s||null, format:formatHint, kws:best?.matched||[]}};
  }
  return {s:best.sp.s, c:best.bestComp || inferGeneralFallbackCategory(sources).c,
    bg:best.sp.bg, fg:best.sp.fg, i:best.sp.i,
    _debug:{confidence:(best.score>=12 || best.compSignal ? 'high':'medium'), score:best.score, second:secondScore, format:formatHint, kws:best.matched, comp:best.bestComp||null}};
};


// ─── TAXONOMIES DÉDIÉES POUR LES NOUVELLES CHAÎNES ─────────────────────────
// Chaque chaîne éditoriale possède sa propre grille de lecture. Le moteur reste
// identique : titre + description + tags + hashtags, scoring strong/medium/weak,
// puis sous-catégorie/émission si elle est reconnue.

window.FTV_FRANCEINFO_SCORED = [
  {s:'Actualité politique', i:'🏛️', bg:'#EEF4FF', fg:'#1A3A6A', comps:[
    {n:'Gouvernement / Élysée', strong:['gouvernement','elysee','elysée','matignon','premier ministre','conseil des ministres','emmanuel macron','macron','president de la republique','président de la république','ministre'], medium:['remaniement','majorite','majorité','opposition'], weak:[]},
    {n:'Assemblée / Sénat', strong:['assemblee nationale','assemblée nationale','senat','sénat','depute','député','senateur','sénateur','motion de censure','49.3','commission d enquete','commission d’enquête'], medium:['parlement','hemicycle','hémicycle','loi','amendement'], weak:[]},
    {n:'Élections', strong:['election','élection','elections','élections','presidentielle','présidentielle','legislatives','législatives','municipales','europeennes','européennes','referendum','référendum','vote','scrutin','sondage'], medium:['candidat','campagne','programme electoral','programme électoral'], weak:[]},
    {n:'Partis / vie politique', strong:['rassemblement national','rn ','la france insoumise','lfi','renaissance','modem','les republicains','les républicains','parti socialiste','europe ecologie les verts','eelv','republicains','républicains'], medium:['coalition','alliance','gauche','droite','extreme droite','extrême droite'], weak:[]},
    {n:'Interview politique', strong:['l invite politique','l’invité politique','interview politique','questions politiques','matinale politique','le grand entretien'], medium:['invite','invité','repond','répond'], weak:[]},
  ], strong:['#politique','politique','macron','gouvernement','election','élection','assemblee nationale','assemblée nationale'], medium:['ministre','depute','député','parti','campagne','loi'], weak:['vote']},

  {s:'International', i:'🌍', bg:'#F0F7FF', fg:'#16446B', comps:[
    {n:'Ukraine / Russie', strong:['ukraine','russie','vladimir poutine','poutine','zelensky','zelenskyy','kyiv','kiev','moscou','guerre en ukraine'], medium:['front ukrainien','armee russe','armée russe'], weak:[]},
    {n:'Moyen-Orient', strong:['gaza','israel','israël','palestine','hamas','jerusalem','jérusalem','iran','liban','hezbollah','syrie','moyen-orient'], medium:['cessez-le-feu','otages','frappe israélienne','frappe israelienne'], weak:[]},
    {n:'États-Unis', strong:['etats-unis','états-unis','usa','donald trump','trump','joe biden','kamala harris','washington','maison blanche'], medium:['congres americain','congrès américain','president americain','président américain'], weak:[]},
    {n:'Europe / UE', strong:['union europeenne','union européenne','bruxelles','commission europeenne','commission européenne','parlement europeen','parlement européen','ue ','otan','europe'], medium:['sommet europeen','sommet européen'], weak:[]},
    {n:'Afrique / Asie / Monde', strong:['afrique','chine','pekin','pékin','taiwan','inde','japon','corée','coree','bresil','brésil','argentine','mexique','canada'], medium:['diplomatie','geopolitique','géopolitique'], weak:[]},
  ], strong:['#international','international','monde','guerre','conflit','diplomatie'], medium:['crise','frontiere','frontière','sanctions','sommet'], weak:[]},

  {s:'Société & faits divers', i:'👥', bg:'#F7F4FF', fg:'#49306B', comps:[
    {n:'Justice', strong:['justice','proces','procès','tribunal','cour d assises','cour d\'assises','condamne','condamné','verdict','audience','avocat','magistrat'], medium:['plainte','jugement','enquete judiciaire','enquête judiciaire'], weak:[]},
    {n:'Police / sécurité', strong:['police','gendarmerie','securite','sécurité','violences urbaines','emeutes','émeutes','arrestation','interpellation','operation de police','opération de police'], medium:['commissariat','forces de l ordre','forces de l’ordre'], weak:[]},
    {n:'Faits divers', strong:['faits divers','meurtre','homicide','disparition','agression','viol','incendie criminel','accident mortel','drame','feminicide','féminicide'], medium:['victime','suspect','temoin','témoin'], weak:[]},
    {n:'Éducation', strong:['ecole','école','college','collège','lycee','lycée','universite','université','parcoursup','bac','enseignants','education nationale','éducation nationale'], medium:['eleves','élèves','etudiants','étudiants'], weak:[]},
    {n:'Société / quotidien', strong:['societe','société','logement','transports','greve','grève','travail','famille','jeunesse','harcelement','harcèlement','discrimination'], medium:['temoignage','témoignage','quotidien'], weak:[]},
  ], strong:['#societe','#société','societe','société','justice','police','faits divers'], medium:['reportage','temoignage','témoignage','enquete','enquête'], weak:[]},

  {s:'Économie & consommation', i:'💶', bg:'#F0FAF4', fg:'#176B3A', comps:[
    {n:'Pouvoir d’achat', strong:['pouvoir d achat','pouvoir d\'achat','inflation','prix','courses','supermarche','supermarché','carburant','loyer','facture','budget des menages','budget des ménages'], medium:['cher','moins cher','hausse des prix'], weak:[]},
    {n:'Emploi / entreprises', strong:['emploi','chomage','chômage','salaire','travail','entreprise','licenciement','recrutement','industrie','usine','greve','grève'], medium:['syndicat','patronat','formation'], weak:[]},
    {n:'Retraites / impôts', strong:['retraite','retraites','impots','impôts','taxe','budget','deficit','déficit','dette publique'], medium:['cotisations','pension'], weak:[]},
    {n:'Arnaques / conso', strong:['arnaque','fraude','escroquerie','consommation','rappel produit','produit dangereux','assurance','banque','credit','crédit'], medium:['consommateur','client','comparatif'], weak:[]},
  ], strong:['economie','économie','inflation','emploi','prix','budget','consommation'], medium:['entreprise','salaire','impots','impôts','arnaque'], weak:[]},

  {s:'Climat & environnement', i:'🌱', bg:'#EEF9F0', fg:'#1A5C32', comps:[
    {n:'Climat', strong:['climat','rechauffement climatique','réchauffement climatique','canicule','secheresse','sécheresse','inondation','inondations','transition climatique'], medium:['temperature record','température record','emissions de co2','émissions de co2'], weak:[]},
    {n:'Environnement', strong:['environnement','ecologie','écologie','pollution','biodiversite','biodiversité','plastique','eau potable','foret','forêt','ocean','océan'], medium:['recyclage','protection de la nature'], weak:[]},
    {n:'Énergie', strong:['energie','énergie','electricite','électricité','gaz','nucleaire','nucléaire','renouvelable','eolienne','éolienne','solaire'], medium:['centrale','reacteur','réacteur'], weak:[]},
    {n:'Agriculture', strong:['agriculture','agriculteurs','pesticides','elevage','élevage','colere des agriculteurs','colère des agriculteurs','salon de l agriculture','salon de l’agriculture'], medium:['recolte','récolte','ferme'], weak:[]},
  ], strong:['climat','environnement','ecologie','écologie','pollution','energie','énergie'], medium:['canicule','secheresse','sécheresse','agriculture'], weak:[]},

  {s:'Santé & sciences', i:'🧬', bg:'#EEF8FA', fg:'#0A5C6B', comps:[
    {n:'Santé publique', strong:['sante','santé','hopital','hôpital','medecin','médecin','urgences','maladie','epidemie','épidémie','vaccin','covid','grippe'], medium:['patient','soins','symptomes','symptômes'], weak:[]},
    {n:'Recherche / sciences', strong:['science','scientifique','chercheurs','recherche','espace','nasa','astronomie','intelligence artificielle','ia ','technologie'], medium:['innovation','decouverte','découverte'], weak:[]},
    {n:'Handicap / inclusion', strong:['handicap','autisme','inclusion','accessibilite','accessibilité','maladie rare'], medium:['aidants','accompagnement'], weak:[]},
  ], strong:['sante','santé','science','recherche','hopital','hôpital'], medium:['medecin','médecin','maladie','ia ','innovation'], weak:[]},

  {s:'Décryptage & formats info', i:'🔎', bg:'#FFF8E8', fg:'#7A5600', comps:[
    {n:'Vrai ou Fake', strong:['vrai ou fake','vraioufaux','fake news','infox','desinformation','désinformation'], medium:['verification','vérification','fact-checking','fact checking'], weak:[]},
    {n:'Le choix franceinfo', strong:['le choix franceinfo','choix franceinfo'], medium:[], weak:[]},
    {n:'L’invité franceinfo', strong:['l invite franceinfo','l’invité franceinfo','invite franceinfo','invité franceinfo'], medium:['interview','entretien'], weak:[]},
    {n:'Décryptage', strong:['decryptage','décryptage','comprendre','on vous explique','explication','pourquoi','comment'], medium:['analyse','questions réponses','questions reponses'], weak:[]},
    {n:'Direct / édition spéciale', strong:['edition speciale','édition spéciale','en direct','direct','live','breaking news','derniere minute','dernière minute'], medium:['suivez','point presse'], weak:[]},
  ], strong:['franceinfo','vrai ou fake','decryptage','décryptage','interview','direct'], medium:['analyse','explication','info'], weak:[]},
];

window.FTV_CULTURE_SCORED = [
  {s:'Musique & concerts', i:'🎵', bg:'#FFF1F3', fg:'#8A1D3A', comps:[
    {n:'Culturebox', strong:['culturebox','concert culturebox','festival culturebox'], medium:[], weak:[]},
    {n:'Taratata', strong:['taratata','nagui'], medium:[], weak:[]},
    {n:'Basique', strong:['basique le concert','basique','basique les sessions'], medium:[], weak:[]},
    {n:'Concerts / live', strong:['concert','live music','en concert','session live','festival','rock en seine','vieilles charrues','francofolies','hellfest','solidays'], medium:['chanson','musique','scene','scène'], weak:[]},
    {n:'Classique / opéra', strong:['musique classique','opera','opéra','orchestre','philharmonie','violon','piano','symphonie'], medium:['chef d orchestre','chef d’orchestre'], weak:[]},
  ], strong:['musique','concert','taratata','culturebox','festival','chanson','artiste musical'], medium:['live','scene','scène','album'], weak:[]},

  {s:'Cinéma & audiovisuel', i:'🎥', bg:'#F4F0FA', fg:'#4A2A7A', comps:[
    {n:'Cannes / festivals', strong:['festival de cannes','cannes 2025','cannes 2026','palme d or','palme d’or','montée des marches','montee des marches','cesar','césar'], medium:['festival cinema','festival cinéma'], weak:[]},
    {n:'Beau geste', strong:['beau geste','pierre lescure'], medium:[], weak:[]},
    {n:'Cinéma', strong:['cinema','cinéma','film','realisateur','réalisateur','actrice','acteur','tournage','sortie au cinema','sortie au cinéma'], medium:['critique film','bande-annonce film'], weak:[]},
    {n:'Séries', strong:['serie','série','series','séries','fiction','saison','episode','épisode','showrunner'], medium:['plateforme','streaming'], weak:[]},
  ], strong:['cinema','cinéma','film','serie','série','acteur','actrice','festival de cannes'], medium:['fiction','tournage','realisateur','réalisateur'], weak:[]},

  {s:'Livres & idées', i:'📚', bg:'#EEF4FF', fg:'#1A3A6A', comps:[
    {n:'La grande librairie', strong:['la grande librairie','augustin trapenard','francois busnel','françois busnel'], medium:[], weak:[]},
    {n:'Littérature', strong:['roman','livre','litterature','littérature','ecrivain','écrivain','auteur','autrice','prix goncourt','rentrée littéraire','rentree litteraire'], medium:['lecture','librairie','edition','édition'], weak:[]},
    {n:'Philosophie / idées', strong:['philosophie','philosophe','essai','debat d idees','débat d’idées','pensee','pensée'], medium:['intellectuel','idee','idée'], weak:[]},
    {n:'Histoire', strong:['histoire','historien','historienne','archives','patrimoine historique','seconde guerre mondiale','moyen age','moyen âge'], medium:['memoire','mémoire'], weak:[]},
  ], strong:['livre','roman','litterature','littérature','ecrivain','écrivain','la grande librairie','histoire','philosophie'], medium:['auteur','autrice','archives','idee','idée'], weak:[]},

  {s:'Arts & patrimoine', i:'🎨', bg:'#F0FAF4', fg:'#176B3A', comps:[
    {n:'Musées / expositions', strong:['musee','musée','exposition','expo','vernissage','louvre','orsay','centre pompidou','grand palais'], medium:['galerie','collection'], weak:[]},
    {n:'Patrimoine', strong:['patrimoine','monument','notre-dame','notre dame','chateau','château','cathedrale','cathédrale','architecture'], medium:['restauration','chef d oeuvre','chef-d’œuvre','chef d’œuvre'], weak:[]},
    {n:'Arts visuels', strong:['peinture','peintre','sculpture','photographie','photo','art contemporain','street art','design'], medium:['artiste plasticien','plasticien'], weak:[]},
    {n:'Marché de l’art', strong:['vente aux encheres','vente aux enchères','commissaire-priseur','oeuvre vendue','œuvre vendue','record aux encheres','record aux enchères'], medium:['collectionneur','estimation'], weak:[]},
  ], strong:['art','arts','patrimoine','musee','musée','exposition','peinture','architecture'], medium:['artiste','oeuvre','œuvre','monument'], weak:[]},

  {s:'Spectacle vivant', i:'🎭', bg:'#FFF6E8', fg:'#8A4D00', comps:[
    {n:'Théâtre', strong:['theatre','théâtre','piece de theatre','pièce de théâtre','comedie francaise','comédie-française','avignon','festival d avignon','festival d’avignon'], medium:['comédien','comedien','mise en scene','mise en scène'], weak:[]},
    {n:'Danse', strong:['danse','ballet','opera de paris','opéra de paris','chorégraphe','choregraphe'], medium:['danseur','danseuse'], weak:[]},
    {n:'Humour / stand-up', strong:['humour','comedie','comédie','stand-up','stand up','humoriste','seul en scene','seul en scène'], medium:['sketch','rire'], weak:[]},
    {n:'Cirque / arts de rue', strong:['cirque','arts de rue','jonglage','acrobat','festival de rue'], medium:['chapiteau'], weak:[]},
  ], strong:['theatre','théâtre','danse','spectacle','scene','scène','humour','festival'], medium:['comedie','comédie','ballet','art vivant'], weak:[]},

  {s:'Médias & culture web', i:'💡', bg:'#EEF8FA', fg:'#0A5C6B', comps:[
    {n:'Interviews culture', strong:['interview','entretien','au micro','rencontre avec','portrait de'], medium:['invite','invité','invitée'], weak:[]},
    {n:'Culture numérique', strong:['jeu video','jeu vidéo','gaming','internet','reseaux sociaux','réseaux sociaux','youtubeur','youtubeuse','streamer','twitch'], medium:['numerique','numérique','web'], weak:[]},
    {n:'Critiques / sélections', strong:['a voir','à voir','selection','sélection','les sorties','notre critique','coup de coeur','coup de cœur'], medium:['agenda culturel','recommandation'], weak:[]},
  ], strong:['culture','culturel','interview','portrait','selection','sélection'], medium:['agenda','sortie','critique'], weak:[]},
];

window.FTV_SLASH_SCORED = [
  {s:'Séries & fictions Slash', i:'🎬', bg:'#FFF0F3', fg:'#8A1D3A', comps:[
    {n:'SKAM France', strong:['skam france','skam'], medium:[], weak:[]},
    {n:'Stalk', strong:['stalk','stalk france'], medium:[], weak:[]},
    {n:'Mental', strong:['mental la serie','mental série','mental saison'], medium:[], weak:[]},
    {n:'Chair tendre', strong:['chair tendre'], medium:[], weak:[]},
    {n:'Parlement', strong:['parlement la serie','parlement série','parlement'], medium:[], weak:[]},
    {n:'Derby Girl', strong:['derby girl'], medium:[], weak:[]},
    {n:'ReuSSS', strong:['reusss','reuss','reu$$$','reuss la serie'], medium:[], weak:[]},
    {n:'Fiction / épisode', strong:['episode','épisode','saison','serie','série','fiction','bande-annonce série','bande annonce série'], medium:['extrait série','extrait serie'], weak:[]},
  ], strong:['serie','série','fiction','episode','épisode','saison','skam','stalk'], medium:['personnage','intrigue','casting','acteur','actrice'], weak:[]},

  {s:'Société jeune', i:'🧩', bg:'#F4F0FA', fg:'#4A2A7A', comps:[
    {n:'Sexualité / relations', strong:['sexualite','sexualité','sexe','couple','relation','relations','amour','dating','appli de rencontre','consentement','contraception'], medium:['rupture','désir','desir','intimite','intimité'], weak:[]},
    {n:'Santé mentale', strong:['sante mentale','santé mentale','depression','dépression','anxiete','anxiété','angoisse','burn-out','burnout','therapie','thérapie','psy'], medium:['mal-être','mal etre','trauma'], weak:[]},
    {n:'Identités / LGBTQIA+', strong:['lgbt','lgbtq','lgbtqia','queer','transgenre','transidentite','transidentité','coming out','non-binaire','non binaire','homophobie','lesbienne','gay'], medium:['identite','identité','genre'], weak:[]},
    {n:'Féminismes', strong:['feminisme','féminisme','feministe','féministe','sexisme','violences sexistes','patriarcat','charge mentale'], medium:['egalite femmes hommes','égalité femmes hommes'], weak:[]},
    {n:'Études / travail / argent', strong:['etudiant','étudiant','etudiante','étudiante','parcoursup','stage','job','travail','premier emploi','argent','salaire','precarite','précarité'], medium:['galere','galère','budget'], weak:[]},
  ], strong:['jeune','jeunes','societe','société','sexualite','sexualité','sante mentale','santé mentale','lgbt','féminisme','feminisme'], medium:['temoignage','témoignage','tabou','generation','génération'], weak:[]},

  {s:'Docs & témoignages', i:'🎙️', bg:'#EEF4FF', fg:'#1A3A6A', comps:[
    {n:'Documentaire', strong:['documentaire','docu','reportage','immersion','en immersion'], medium:['long format','histoire vraie'], weak:[]},
    {n:'Témoignage', strong:['temoignage','témoignage','ils racontent','elles racontent','mon histoire','j ai vecu','j’ai vécu','face camera','face caméra'], medium:['confession','récit','recit'], weak:[]},
    {n:'Portrait', strong:['portrait','rencontre avec','qui est','une journee avec','une journée avec'], medium:['dans la vie de'], weak:[]},
    {n:'Décryptage', strong:['on explique','on t explique','on t’explique','comprendre','decryptage','décryptage','pourquoi','comment'], medium:['questions réponses','questions reponses'], weak:[]},
  ], strong:['documentaire','reportage','temoignage','témoignage','portrait','immersion'], medium:['recit','récit','histoire','coulisses'], weak:[]},

  {s:'Culture urbaine & musique', i:'🎧', bg:'#FFF6E8', fg:'#8A4D00', comps:[
    {n:'Rap / hip-hop', strong:['rap','hip-hop','hip hop','freestyle','rappeur','rappeuse','booska','planete rap','planète rap'], medium:['clip','album rap'], weak:[]},
    {n:'Musique', strong:['musique','chanson','concert','festival','artiste','album','single','session live'], medium:['clip','tournée','tournee'], weak:[]},
    {n:'Culture web', strong:['youtubeur','youtubeuse','tiktok','tiktokeur','streamer','twitch','influenceur','influenceuse','reseaux sociaux','réseaux sociaux'], medium:['viral','buzz','internet'], weak:[]},
    {n:'Mode / tendances', strong:['mode','fashion','look','style','sneakers','streetwear','tendance'], medium:['marque','outfit'], weak:[]},
  ], strong:['rap','musique','culture urbaine','youtubeur','streamer','tiktok','mode'], medium:['viral','tendance','clip','festival'], weak:[]},

  {s:'Humour & formats digitaux', i:'⚡', bg:'#EEF8FA', fg:'#0A5C6B', comps:[
    {n:'Formats courts', strong:['short','shorts','reel','format court','top 5','top 10','best of','best-of'], medium:['minute','episode court','épisode court'], weak:[]},
    {n:'Humour', strong:['humour','comique','comedie','comédie','sketch','parodie','meme','mème'], medium:['drôle','drole','rire'], weak:[]},
    {n:'Interviews / face cam', strong:['interview','face cam','facecam','au micro','questions à','questions a','reaction','réaction'], medium:['invite','invité','invitée'], weak:[]},
    {n:'Making-of / coulisses', strong:['making-of','making of','coulisses','behind the scenes','bêtisier','betisier'], medium:['tournage','backstage'], weak:[]},
  ], strong:['humour','short','shorts','interview','coulisses','reaction','réaction'], medium:['format','video verticale','vidéo verticale'], weak:[]},
];


// ─── RENFORCEMENT TAXONOMIES NOUVELLES CHAÎNES — v52 ───────────────────────
// On n'intervient ni sur SPORT, ni sur FRANCE TV. Ces ajouts renforcent uniquement
// FRANCEINFO, CULTURE et SLASH : plus de programmes exacts, plus de formats
// éditoriaux et des fallbacks spécifiques par chaîne.
function addCompsToTheme(rules, themeName, comps){
  const theme=(rules||[]).find(t=>t.s===themeName);
  if(!theme) return;
  const existing=new Set((theme.comps||[]).map(c=>c.n));
  theme.comps=theme.comps||[];
  for(const c of comps){ if(c && c.n && !existing.has(c.n)){ theme.comps.push(c); existing.add(c.n); } }
}
function addThemeIfMissing(rules, theme){
  if(!rules || !theme || !theme.s) return;
  if(!rules.some(t=>t.s===theme.s)) rules.push(theme);
}

// FRANCEINFO — formats d'antenne + verticales news plus précises.
addCompsToTheme(window.FTV_FRANCEINFO_SCORED,'Décryptage & formats info',[
  {n:'Le vrai du faux', strong:['le vrai du faux','vrai du faux','vrai ou faux'], medium:['fact-check','fact checking','fact-checking','verification','vérification'], weak:[]},
  {n:'Les informés', strong:['les informes','les informés','les informes de franceinfo','les informés de franceinfo'], medium:['debat','débat','plateau info'], weak:[]},
  {n:'8h30 franceinfo', strong:['8h30 franceinfo','8 h 30 franceinfo','8h30','8 h 30'], medium:['matinale franceinfo'], weak:[]},
  {n:'franceinfo junior', strong:['franceinfo junior','info junior'], medium:['questions d enfants','questions d’enfants'], weak:[]},
  {n:'Ça dit quoi ?', strong:['ca dit quoi','ça dit quoi','ca dit quoi ?','ça dit quoi ?'], medium:['actu des ados','ados'], weak:[]},
  {n:'Le brief politique', strong:['le brief politique','brief politique'], medium:['politique du jour'], weak:[]},
  {n:'Tout comprendre', strong:['tout comprendre','on vous explique','on t explique','on t’explique','comprendre en trois minutes'], medium:['explication','explicateur'], weak:[]}
]);
addCompsToTheme(window.FTV_FRANCEINFO_SCORED,'Actualité politique',[
  {n:'Réforme / loi', strong:['reforme','réforme','projet de loi','proposition de loi','texte de loi','promulgation','censure du gouvernement'], medium:['debat parlementaire','débat parlementaire'], weak:[]},
  {n:'Politique locale', strong:['maire','municipales','conseil municipal','departementales','départementales','regionales','régionales'], medium:['collectivite','collectivité'], weak:[]}
]);
addCompsToTheme(window.FTV_FRANCEINFO_SCORED,'International',[
  {n:'Guerre Israël-Hamas', strong:['guerre israel hamas','guerre israël hamas','israel-hamas','israël-hamas','conflit israelo-palestinien','conflit israélo-palestinien'], medium:['bande de gaza','otages israéliens','otages israeliens'], weak:[]},
  {n:'Présidentielle américaine', strong:['presidentielle americaine','présidentielle américaine','election americaine','élection américaine','primaires americaines','primaires américaines'], medium:['campagne americaine','campagne américaine'], weak:[]}
]);
addThemeIfMissing(window.FTV_FRANCEINFO_SCORED,{s:'Météo, territoires & régions', i:'🗺️', bg:'#F0FAF6', fg:'#0F5C3F', comps:[
  {n:'Météo / vigilance', strong:['meteo','météo','vigilance orange','vigilance rouge','alerte meteo','alerte météo','intemperies','intempéries','tempete','tempête','orage','neige','canicule'], medium:['pluie','rafales','crue'], weak:[]},
  {n:'Régions / local', strong:['en region','en région','regions','régions','maire de','habitants de','commune de','departement','département'], medium:['territoire','local','ville de'], weak:[]},
  {n:'Transports', strong:['sncf','train','rer','metro','métro','aeroport','aéroport','greve des transports','grève des transports','trafic routier'], medium:['embouteillage','circulation'], weak:[]}
], strong:['meteo','météo','regions','régions','territoires','transports','sncf'], medium:['local','commune','departement','département'], weak:[]});
addThemeIfMissing(window.FTV_FRANCEINFO_SCORED,{s:'Culture, sport & médias', i:'📺', bg:'#FFF1F3', fg:'#8A1D3A', comps:[
  {n:'Sport', strong:['sport','jeux olympiques','jo ','coupe du monde','tour de france','roland-garros','roland garros','football','rugby','tennis'], medium:['athlete','athlète','match'], weak:[]},
  {n:'Culture', strong:['cinema','cinéma','festival de cannes','musique','concert','livre','roman','exposition','musee','musée'], medium:['artiste','acteur','actrice'], weak:[]},
  {n:'Médias / numérique', strong:['medias','médias','reseaux sociaux','réseaux sociaux','intelligence artificielle','ia ','internet','tiktok','x twitter'], medium:['plateforme','numerique','numérique'], weak:[]}
], strong:['sport','culture','medias','médias','internet','reseaux sociaux','réseaux sociaux'], medium:['festival','jo ','intelligence artificielle'], weak:[]});

// CULTURE — programmes, festivals, disciplines et formes plus détaillés.
addCompsToTheme(window.FTV_CULTURE_SCORED,'Musique & concerts',[
  {n:'Victoires de la musique', strong:['victoires de la musique','les victoires de la musique'], medium:[], weak:[]},
  {n:'Eurovision', strong:['eurovision','eurovision song contest'], medium:['selection eurovision','sélection eurovision'], weak:[]},
  {n:'Fête de la musique', strong:['fete de la musique','fête de la musique'], medium:[], weak:[]},
  {n:'Rap / musiques urbaines', strong:['rap','hip-hop','hip hop','rappeur','rappeuse','slam','rnb','musiques urbaines'], medium:['freestyle','beatmaker'], weak:[]},
  {n:'Jazz / musiques du monde', strong:['jazz','jazz a vienne','jazz à vienne','musiques du monde','world music'], medium:['blues','soul'], weak:[]}
]);
addCompsToTheme(window.FTV_CULTURE_SCORED,'Cinéma & audiovisuel',[
  {n:'Oscars / prix cinéma', strong:['oscars','oscar','golden globes','bafta','prix lumières','prix lumieres'], medium:['ceremonie','cérémonie'], weak:[]},
  {n:'Animation / manga', strong:['film d animation','film d’animation','animation japonaise','manga','anime','animé'], medium:['studio ghibli','dessin anime','dessin animé'], weak:[]},
  {n:'Documentaire cinéma', strong:['documentaire cinéma','documentaire cinema','film documentaire'], medium:['realisateur documentaire','réalisateur documentaire'], weak:[]}
]);
addCompsToTheme(window.FTV_CULTURE_SCORED,'Livres & idées',[
  {n:'Bande dessinée / manga', strong:['bande dessinee','bande dessinée','bd ','roman graphique','manga','angouleme','angoulême'], medium:['dessinateur','illustrateur'], weak:[]},
  {n:'Prix littéraires', strong:['prix goncourt','prix renaudot','prix femina','prix medicis','prix médicis','prix interallié','prix interallie'], medium:['prix litteraire','prix littéraire'], weak:[]},
  {n:'Essais / société', strong:['essai','essais','sociologue','philosophe','anthropologue','science politique'], medium:['debat d idees','débat d’idées'], weak:[]}
]);
addCompsToTheme(window.FTV_CULTURE_SCORED,'Arts & patrimoine',[
  {n:'Notre-Dame / patrimoine religieux', strong:['notre-dame','notre dame','cathedrale','cathédrale','vitraux','fleche de notre-dame','flèche de notre-dame'], medium:['restauration patrimoniale'], weak:[]},
  {n:'Design / mode', strong:['design','mode','fashion week','haute couture','couturier','couturiere','couturière','styliste'], medium:['tendance','collection'], weak:[]},
  {n:'Archéologie', strong:['archeologie','archéologie','fouille','fouilles','antiquite','antiquité','egypte antique','égypte antique'], medium:['decouverte archeologique','découverte archéologique'], weak:[]}
]);
addCompsToTheme(window.FTV_CULTURE_SCORED,'Spectacle vivant',[
  {n:'Festival d’Avignon', strong:['festival d avignon','festival d’avignon','avignon off','cour d honneur','cour d’honneur'], medium:['avignon'], weak:[]},
  {n:'Comédie musicale', strong:['comedie musicale','comédie musicale','musical','cabaret'], medium:['broadway'], weak:[]},
  {n:'Opéra / lyrique', strong:['opera','opéra','art lyrique','tenor','ténor','soprano'], medium:['aria','recital','récital'], weak:[]}
]);
addThemeIfMissing(window.FTV_CULTURE_SCORED,{s:'Télévision & programmes culturels', i:'📡', bg:'#F7F4FF', fg:'#49306B', comps:[
  {n:'Passage des arts', strong:['passage des arts','claire chazal'], medium:[], weak:[]},
  {n:'D’art d’art', strong:['d art d art','d’art d’art','d art art'], medium:[], weak:[]},
  {n:'Stupéfiant !', strong:['stupéfiant','stupefiant','stupéfiant !'], medium:[], weak:[]},
  {n:'Culture prime / entretien', strong:['grand entretien','entretien culture','interview culture','portrait culture'], medium:['rencontre avec'], weak:[]}
], strong:['programme culturel','emission culturelle','émission culturelle','interview culture','portrait culture'], medium:['entretien','plateau culture'], weak:[]});

// SLASH — programmes jeunes, sujets sociétaux et formats digitaux renforcés.
addCompsToTheme(window.FTV_SLASH_SCORED,'Séries & fictions Slash',[
  {n:'Askip', strong:['askip','askip la serie','askip la série'], medium:[], weak:[]},
  {n:'Miskina', strong:['miskina','miskina la pauvre'], medium:[], weak:[]},
  {n:'Doxa', strong:['doxa'], medium:['mini serie doxa','mini-série doxa'], weak:[]},
  {n:'Moah', strong:['moah'], medium:['serie moah','série moah'], weak:[]},
  {n:'Bouchon', strong:['bouchon la serie','bouchon série','bouchon serie'], medium:[], weak:[]}
]);
addCompsToTheme(window.FTV_SLASH_SCORED,'Société jeune',[
  {n:'Corps / image de soi', strong:['corps','image de soi','complexes','grossophobie','body positive','bodypositive','troubles alimentaires','tca'], medium:['poids','apparence'], weak:[]},
  {n:'Racisme / discriminations', strong:['racisme','raciste','discrimination','discriminations','antisemitisme','antisémitisme','islamophobie','xenophobie','xénophobie'], medium:['minorites','minorités'], weak:[]},
  {n:'Écologie jeune', strong:['ecologie','écologie','climat','eco-anxiete','éco-anxiété','militant climat','activiste climat'], medium:['engagement','militantisme'], weak:[]}
]);
addCompsToTheme(window.FTV_SLASH_SCORED,'Docs & témoignages',[
  {n:'Micro-trottoir', strong:['micro-trottoir','micro trottoir','dans la rue','on a demandé','on a demande'], medium:['question aux jeunes','les jeunes répondent'], weak:[]},
  {n:'Immersion métier / études', strong:['immersion','une journee avec','une journée avec','dans la peau de','metier','métier','ecole','école','campus'], medium:['orientation','parcours'], weak:[]},
  {n:'Enquête jeune', strong:['enquete','enquête','investigation','on a enquete','on a enquêté'], medium:['reportage'], weak:[]}
]);
addCompsToTheme(window.FTV_SLASH_SCORED,'Culture urbaine & musique',[
  {n:'Manga / anime', strong:['manga','anime','animé','japan expo','cosplay'], medium:['otaku','k-pop','kpop'], weak:[]},
  {n:'Gaming / e-sport', strong:['gaming','jeu video','jeu vidéo','esport','e-sport','streamer','twitch','fortnite','minecraft'], medium:['gameur','gameuse'], weak:[]},
  {n:'Créateurs / influence', strong:['influenceur','influenceuse','createur de contenu','créateur de contenu','youtubeur','youtubeuse','tiktokeur','tiktokeuse'], medium:['reseaux sociaux','réseaux sociaux'], weak:[]}
]);
addCompsToTheme(window.FTV_SLASH_SCORED,'Humour & formats digitaux',[
  {n:'Shorts / vertical', strong:['#shorts','shorts','format vertical','video verticale','vidéo verticale','reel','reels'], medium:['moins d une minute','moins d’une minute'], weak:[]},
  {n:'Réactions / débats', strong:['reaction','réaction','debat','débat','on reagit','on réagit','ils reagissent','ils réagissent'], medium:['avis des jeunes'], weak:[]}
]);
addThemeIfMissing(window.FTV_SLASH_SCORED,{s:'Engagement & société', i:'✊', bg:'#F0FAF4', fg:'#176B3A', comps:[
  {n:'Militantisme', strong:['militant','militante','militantisme','activiste','manifestation','manif','collectif'], medium:['engagement','mobilisation'], weak:[]},
  {n:'Climat / planète', strong:['climat','planete','planète','ecologie','écologie','fast fashion','zero dechet','zéro déchet'], medium:['sobriete','sobriété'], weak:[]},
  {n:'Droits sociaux', strong:['precarite','précarité','logement','bourse etudiante','bourse étudiante','inegalites','inégalités'], medium:['solidarite','solidarité'], weak:[]}
], strong:['militantisme','engagement','climat','ecologie','écologie','droits','manifestation'], medium:['mobilisation','collectif','justice sociale'], weak:[]});

const FTV_FRANCEINFO_PROGRAM_COMPS = new Set(['Vrai ou Fake','Le vrai du faux','Le choix franceinfo','L’invité franceinfo','Les informés','8h30 franceinfo','franceinfo junior','Ça dit quoi ?','Le brief politique','Tout comprendre','Décryptage','Direct / édition spéciale','Interview politique']);
const FTV_CULTURE_PROGRAM_COMPS = new Set(['Culturebox','Taratata','Basique','La grande librairie','Beau geste','Cannes / festivals','Musées / expositions','Théâtre','Victoires de la musique','Eurovision','Fête de la musique','Festival d’Avignon','Passage des arts','D’art d’art','Stupéfiant !','Oscars / prix cinéma','Prix littéraires']);
const FTV_SLASH_PROGRAM_COMPS = new Set(['SKAM France','Stalk','Mental','Chair tendre','Parlement','Derby Girl','ReuSSS','Askip','Miskina','Doxa','Moah','Bouchon','Fiction / épisode','Micro-trottoir','Shorts / vertical']);

function inferFranceinfoFallbackCategory(sources){
  const text=sources.all.raw, title=sources.title.raw;
  const has=(...arr)=>arr.some(x=>title.includes(norm(x))||text.includes(norm(x)));
  if(has('direct','live','edition speciale','édition spéciale','breaking news','derniere minute','dernière minute')) return {s:'Décryptage & formats info', c:'Direct / édition spéciale'};
  if(has('vrai ou fake','vrai du faux','fake news','desinformation','désinformation','infox')) return {s:'Décryptage & formats info', c:'Vrai ou Fake'};
  if(has('interview','invite','invité','entretien','8h30','matinale')) return {s:'Décryptage & formats info', c:'L’invité franceinfo'};
  if(has('macron','gouvernement','ministre','assemblee','assemblée','senat','sénat','election','élection','parti')) return {s:'Actualité politique', c:'Politique générale'};
  if(has('ukraine','russie','gaza','israel','israël','trump','etats-unis','états-unis','europe','chine','international')) return {s:'International', c:'International'};
  if(has('justice','police','faits divers','tribunal','proces','procès','meurtre','disparition')) return {s:'Société & faits divers', c:'Justice / faits divers'};
  if(has('inflation','prix','pouvoir d achat','pouvoir d\'achat','emploi','economie','économie','consommation','arnaque')) return {s:'Économie & consommation', c:'Économie / consommation'};
  if(has('climat','environnement','meteo','météo','pollution','energie','énergie','agriculture')) return {s:'Climat & environnement', c:'Climat / environnement'};
  if(has('sante','santé','hopital','hôpital','science','recherche','ia ','intelligence artificielle')) return {s:'Santé & sciences', c:'Santé / sciences'};
  if(has('sport','jo ','jeux olympiques','culture','cinema','cinéma','musique','medias','médias')) return {s:'Culture, sport & médias', c:'Culture / sport / médias'};
  return {s:'Décryptage & formats info', c:'Actualité générale'};
}
function inferCultureFallbackCategory(sources){
  const text=sources.all.raw, title=sources.title.raw;
  const has=(...arr)=>arr.some(x=>title.includes(norm(x))||text.includes(norm(x)));
  if(has('concert','musique','chanson','album','festival','taratata','culturebox','rap','jazz','opera','opéra')) return {s:'Musique & concerts', c:'Musique / concerts'};
  if(has('cinema','cinéma','film','acteur','actrice','realisateur','réalisateur','serie','série','cannes','oscars')) return {s:'Cinéma & audiovisuel', c:'Cinéma / audiovisuel'};
  if(has('livre','roman','auteur','autrice','ecrivain','écrivain','litterature','littérature','bd ','bande dessinee','bande dessinée')) return {s:'Livres & idées', c:'Livres / idées'};
  if(has('musee','musée','exposition','expo','art','peinture','patrimoine','architecture','design','mode')) return {s:'Arts & patrimoine', c:'Arts / patrimoine'};
  if(has('theatre','théâtre','danse','spectacle','humour','stand-up','festival d avignon','festival d’avignon')) return {s:'Spectacle vivant', c:'Spectacle vivant'};
  if(has('interview','entretien','portrait','programme culturel','emission culturelle','émission culturelle')) return {s:'Télévision & programmes culturels', c:'Entretien / programme'};
  if(has('web','internet','reseaux sociaux','réseaux sociaux','gaming','youtubeur','streamer')) return {s:'Médias & culture web', c:'Culture web'};
  return {s:'Médias & culture web', c:'Culture générale'};
}
function inferSlashFallbackCategory(sources){
  const text=sources.all.raw, title=sources.title.raw;
  const has=(...arr)=>arr.some(x=>title.includes(norm(x))||text.includes(norm(x)));
  if(has('skam','stalk','mental','chair tendre','parlement','derby girl','reusss','askip','miskina','episode','épisode','saison','serie','série')) return {s:'Séries & fictions Slash', c:'Série / épisode'};
  if(has('sexualite','sexualité','sexe','couple','amour','consentement','sante mentale','santé mentale','lgbt','queer','feminisme','féminisme','racisme','discrimination')) return {s:'Société jeune', c:'Société jeune'};
  if(has('documentaire','reportage','temoignage','témoignage','portrait','immersion','micro-trottoir','micro trottoir')) return {s:'Docs & témoignages', c:'Docs / témoignages'};
  if(has('rap','musique','gaming','jeu video','jeu vidéo','manga','anime','mode','tiktok','influenceur','streamer')) return {s:'Culture urbaine & musique', c:'Pop culture / musique'};
  if(has('short','shorts','humour','sketch','reaction','réaction','coulisses','making of','face cam','facecam')) return {s:'Humour & formats digitaux', c:'Format digital'};
  if(has('climat','ecologie','écologie','militant','manifestation','precarite','précarité','engagement')) return {s:'Engagement & société', c:'Engagement'};
  return {s:'Humour & formats digitaux', c:'Format digital'};
}

window.FTV_CHANNEL_TAXONOMIES = {
  francetv: {rules: () => window.FTV_GENERAL_SCORED, programComps: () => FTV_GENERAL_PROGRAM_COMPS, fallback: inferGeneralFallbackCategory},
  franceinfo: {rules: () => window.FTV_FRANCEINFO_SCORED, programComps: () => FTV_FRANCEINFO_PROGRAM_COMPS, fallback: inferFranceinfoFallbackCategory},
  francetvculture: {rules: () => window.FTV_CULTURE_SCORED, programComps: () => FTV_CULTURE_PROGRAM_COMPS, fallback: inferCultureFallbackCategory},
  slash: {rules: () => window.FTV_SLASH_SCORED, programComps: () => FTV_SLASH_PROGRAM_COMPS, fallback: inferSlashFallbackCategory}
};
window.isGeneralChannel = function(channelKey){
  return !!(channelKey && window.FTV_CHANNEL_TAXONOMIES && window.FTV_CHANNEL_TAXONOMIES[channelKey]);
};
window.isHeavyChannel = function(channelKey){ return channelKey && channelKey !== 'sport'; };
function metaFromRules(rules, name){
  return (rules || []).find(t => t.s === name) || {s:name || 'Contenu', i:'📺', bg:'#F5F7FA', fg:'#344054'};
}
function classifyWithRules(rules, programComps, fallbackFn, input, tags=[], description=''){
  const sources = buildSearchSources(input, tags, description);
  let best = null, second = null;
  for (const theme of (rules || [])) {
    const r = scoreSport(theme, sources);
    const item = {sp:theme, ...r};
    if (item.bestComp && programComps && programComps.has(item.bestComp)) item.score += 38;
    if (!best || item.score > best.score) { second = best; best = item; }
    else if (!second || item.score > second.score) second = item;
  }
  const secondScore = second?.score || 0;
  const formatHint = detectGeneralFormat(sources);
  const gap = (best?.score || 0) - secondScore;
  const strongEnough = best && (best.compSignal || best.titleSignal || best.score >= 6 || gap >= 2.5);
  const fb = (fallbackFn || inferGeneralFallbackCategory)(sources);
  if (!strongEnough) {
    const meta = metaFromRules(rules, fb.s);
    return {s:meta.s, c:fb.c, bg:meta.bg, fg:meta.fg, i:meta.i,
      _debug:{confidence:'fallback_channel', score:best?.score||0, second:secondScore, candidate:best?.sp?.s||null, format:formatHint, kws:best?.matched||[]}};
  }
  return {s:best.sp.s, c:best.bestComp || fb.c,
    bg:best.sp.bg, fg:best.sp.fg, i:best.sp.i,
    _debug:{confidence:(best.score>=12 || best.compSignal ? 'high':'medium'), score:best.score, second:secondScore, format:formatHint, kws:best.matched, comp:best.bestComp||null}};
}
window.classifyEditorial = function(input, tags=[], description=''){
  const channel = input && typeof input === 'object' ? input.channelKey : 'francetv';
  const tx = window.FTV_CHANNEL_TAXONOMIES[channel] || window.FTV_CHANNEL_TAXONOMIES.francetv;
  if (channel === 'francetv') return window.classifyGeneral(input, tags, description);
  return classifyWithRules(tx.rules(), tx.programComps(), tx.fallback, input, tags, description);
};

// ─── OVERRIDES MANUELS ──────────────────────────────────────────────────────
// Version allégée : uniquement les corrections manuelles par ID vidéo.
// Pas d'apprentissage automatique, donc moins d'écritures localStorage et plus de contrôle.
const OVERRIDE_KEY = 'ftvsport_manual_overrides';
window.FTV_AUTO_LEARNING_ENABLED = false;
window.FTVLearning = (function(){
  const read = () => { try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}'); } catch(e) { return {}; } };
  const write = (obj) => { try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(obj || {})); } catch(e) {} };
  let overrides = read();
  return {
    setOverride(videoId, sport, comp){ if(!videoId || !sport) return; overrides[videoId] = {sport, comp: comp || null}; write(overrides); },
    clearOverride(videoId){ if(!videoId) return; delete overrides[videoId]; write(overrides); },
    getOverride(videoId){ return videoId ? overrides[videoId] : null; },
    listOverrides(){ return {...overrides}; },
    countOverrides(){ return Object.keys(overrides).length; },
    resetOverrides(){ overrides = {}; write(overrides); },
    matchLearned(){ return {}; },
    learnFromTitle(){},
    listLearned(){ return {}; },
    countLearned(){ return 0; },
    resetLearning(){},
    boostLearningFromOverride(){}
  };
})();

window.classify = function(input, tags=[], description='') {
  const channel = input && typeof input === 'object' ? input.channelKey : null;
  if (window.isGeneralChannel && window.isGeneralChannel(channel)) return window.classifyEditorial(input, tags, description);
  return window.classifySport(input, tags, description);
};


// V108 : garde-fou anti « Tennis fourre-tout ».
// Certains Shorts récupèrent des descriptions/tags très génériques qui peuvent
// faire remonter Tennis alors que le titre parle clairement de foot, rugby, vélo,
// ski, etc. Dans ce cas, on rejuge la vidéo au titre seul et on ne conserve
// Tennis que si le titre contient un vrai signal tennis/Roland-Garros.
function ftvGetRawTitle(input){
  if (input && typeof input === 'object') return String(input.title || input.snippet?.title || input.name || '').trim();
  return String(input || '').trim();
}
function ftvHasTennisTitleSignal(title){
  const t = ' ' + norm(title) + ' ';
  return [
    ' tennis ',' roland garros ',' roland-garros ',' rolandgarros ',' rg2025 ',' rg2026 ',
    ' wimbledon ',' us open tennis ',' australian open ',' open d australie ',
    ' coupe davis ',' davis cup ',' atp ',' wta ',' balle de match ',' tie break ',
    ' tie-break ',' court central ',' philippe chatrier ',' suzanne lenglen ',
    ' djokovic ',' alcaraz ',' sinner ',' swiatek ',' sabalenka ',' gauff ',' monfils ',
    ' humbert ',' moutet ',' arthur fils ',' fils tennis ',' lois boisson ',' loïs boisson ',' boisson tennis ',' garcia ',' cornet ',' mladenovic ',' paolini ',' nadal ',
    ' federer ',' medvedev ',' zverev ',' tsitsipas '
  ].some(k => t.includes(k));
}
function ftvIsGenericSportResult(cls){
  return !cls || ['Sports généralistes','Multi-sports','Autres sports'].includes(cls.s);
}
function ftvFixTennisShortMisclassification(input, result){
  try{
    if (!result || result.s !== 'Tennis') return result;
    const title = ftvGetRawTitle(input);
    if (!title || ftvHasTennisTitleSignal(title)) return result;
    const dur = input && typeof input === 'object' ? (window.getVideoDurationSecs ? window.getVideoDurationSecs(input) : window.getDurationSecs(input.duration)) : 0;
    const type = input && typeof input === 'object' ? (input.type || window.classifyType?.(title, dur, false)) : window.classifyType?.(title, dur, false);
    // On cible surtout le problème visible : Shorts rangés dans Tennis par bruit de description/tags.
    if (type !== 'short') return result;
    const titleOnly = __FTV_CLASSIFY_RAW(title, [], '');
    if (titleOnly && titleOnly.s && titleOnly.s !== 'Tennis') return titleOnly;
    // Si le titre seul ne permet pas un sport fiable, mieux vaut sortir de Tennis
    // plutôt que polluer Roland-Garros / Tennis avec du contenu autre sport.
    const cat = (titleOnly && titleOnly.c) || 'Shorts à reclasser';
    return {s:'Multi-sports', c:cat, bg:'#F0F7FF', fg:'#1B4D7A', i:'🏅', _debug:{confidence:'tennis_guard_title_only', previous:'Tennis'}};
  }catch(e){ return result; }
}

function ftvTitleLockedClassification(input){
  try{
    const title = ftvGetRawTitle(input);
    const n = norm(title);
    if (!n) return null;
    const mk = (sport, comp, debug) => {
      const sp = (window.SR_SCORED || []).find(x => x.s === sport) || {};
      return {s:sport, c:comp, bg:sp.bg || '#F5F5F5', fg:sp.fg || '#111827', i:sp.i || '•', _debug:{confidence:'title_lock', rule:debug || sport, score:999, kws:['title:'+debug]}};
    };

    if (/\b(investec\s*)?champions\s*cup\b/.test(n) || /#investecchampionscup|#championscup/.test(n)) return mk('Rugby','Champions Cup','rugby_champions_cup');
    if (/\bchallenge\s*cup\b/.test(n) || /#challengecup/.test(n)) return mk('Rugby','Challenge Cup','rugby_challenge_cup');
    if (/\b(top\s*14|top14)\b/.test(n) || /#top14/.test(n)) return mk('Rugby','Top 14','rugby_top14');
    if (/\b(six\s*nations|6\s*nations|tournoi\s+des\s+(six|6)\s+nations)\b/.test(n) || /#sixnations|#6nations/.test(n)) return mk('Rugby','Six Nations','rugby_six_nations');
    if (/\b(xv\s+de\s+france|dupont\s+rugby|ntamack|alldritt|fickou|penaud|mauvaka|jalibert|ramos\s+rugby)\b/.test(n)) return mk('Rugby','Rugby','rugby_entity');

    if (/\b(roland\s*garros|roland-garros|rolandgarros)\b/.test(n) || /#rolandgarros|#rg2025|#rg2026/.test(n)) return mk('Tennis','Roland-Garros','tennis_roland_garros');
    if (/\b(wimbledon|us\s+open\s+(de\s+)?tennis|australian\s+open|open\s+d\s+australie|coupe\s+davis|davis\s+cup|atp\s+finals|wta\s+finals)\b/.test(n)) return mk('Tennis','Tennis','tennis_competition');
    if (/\b(alcaraz|sinner|djokovic|nadal|federer|zverev|medvedev|swiatek|sabalenka|gauff|paolini|humbert\b|monfils\b|moutet\b|boisson\b)\b/.test(n)) return mk('Tennis','Tennis','tennis_entity');

    if (/\b(tour\s+de\s+france|tdf\b|paris\s*roubaix|giro\b|vuelta\b|criterium\s+du\s+dauphine|critérium\s+du\s+dauphiné)\b/.test(n)) return mk('Cyclisme','Cyclisme','cycling_competition');
    if (/\b(pogacar|vingegaard|van\s+der\s+poel|van\s+aert|evenepoel|alaphilippe|bardet)\b/.test(n)) return mk('Cyclisme','Cyclisme','cycling_entity');
    if (/\b(leon\s+marchand|léon\s+marchand|manaudou|natation|swimming|world\s+aquatics)\b/.test(n)) return mk('Natation','Natation','swimming_title');
    if (/\b(mbappe|mbappé|psg\b|ligue\s+1\b|champions\s+league\s+football|equipe\s+de\s+france\s+de\s+football|coupe\s+de\s+france\s+football)\b/.test(n)) return mk('Football','Football','football_title');
    if (/\b(nba\b|wembanyama|wemby\b|eurobasket|basket\b|basketball)\b/.test(n)) return mk('Basket-ball','Basket-ball','basket_title');
    if (/\b(handball|mondial\s+de\s+handball|euro\s+de\s+handball|ligue\s+des\s+champions\s+handball)\b/.test(n)) return mk('Handball','Handball','handball_title');
    return null;
  }catch(e){ return null; }
}



// Garde-fou de cohérence titre -> classement.
// Cette couche ne change pas la logique générale : elle empêche seulement un cache,
// des tags SEO ou une description bruitée de classer une vidéo dans un sport qui
// contredit clairement le titre affiché.
function ftvHardTitleClassification(input){
  try{
    const title = ftvGetRawTitle(input);
    if (!title) return null;
    const n = norm(title);
    const compact = n.replace(/[^a-z0-9#]+/g,'');
    const raw = String(title||'');
    const mk = (sport, comp, rule) => {
      const sp = (window.SR_SCORED || []).find(x => x.s === sport) || {};
      return {s:sport, c:comp, bg:sp.bg || '#F5F5F5', fg:sp.fg || '#111827', i:sp.i || '•', _debug:{confidence:'title_guard', rule, score:1000, kws:['title:'+rule]}};
    };

    // Rugby : on met volontairement ces règles avant Tennis car le bug observé
    // vient d'un short rugby hérité dans Roland-Garros via tags/cache.
    if (/🏉/.test(raw) || /#investecchampionscup|#championscup|investecchampionscup|championscup/.test(compact) || /\bchampions\s*cup\b/.test(n)) return mk('Rugby','Champions Cup','rugby_champions_cup');
    if (/#challengecup|challengecup/.test(compact) || /\bchallenge\s*cup\b/.test(n)) return mk('Rugby','Challenge Cup','rugby_challenge_cup');
    if (/#top14|\btop\s*14\b|\btop14\b/.test(n)) return mk('Rugby','Top 14','rugby_top14');
    if (/#sixnations|#6nations|sixnations|\bsix\s*nations\b|\b6\s*nations\b/.test(n)) return mk('Rugby','Six Nations','rugby_six_nations');
    if (/\b(toulon|la\s+rochelle|stade\s+toulousain|racing\s+92|clermont\s+asm|asm\s+clermont|ubb\b|bordeaux\s+begles|xv\s+de\s+france|antoine\s+dupont|ntamack|alldritt|fickou|penaud|mauvaka|jalibert|ramos)\b/.test(n)) return mk('Rugby','Rugby','rugby_title_entity');

    // Tennis : uniquement si le titre contient vraiment un signal tennis.
    if (/#rolandgarros|#rg2025|#rg2026|rolandgarros|\broland\s*garros\b|\broland-garros\b/.test(compact) || /\broland\s*garros\b|\broland-garros\b/.test(n)) return mk('Tennis','Roland-Garros','tennis_roland_garros');
    if (/\b(wimbledon|us\s+open\s+(de\s+)?tennis|australian\s+open|open\s+d\s+australie|coupe\s+davis|davis\s+cup|atp\b|wta\b|tie[-\s]*break|balle\s+de\s+match|balle\s+de\s+break)\b/.test(n)) return mk('Tennis','Tennis','tennis_competition');
    if (/\b(alcaraz|sinner|djokovic|nadal|federer|zverev|medvedev|tsitsipas|swiatek|sabalenka|gauff|paolini|humbert|monfils|moutet|lois\s+boisson|loïs\s+boisson|diane\s+parry|caroline\s+garcia)\b/.test(n)) return mk('Tennis','Tennis','tennis_entity');

    if (/\b(tour\s+de\s+france|tdf\b|paris\s*roubaix|giro\b|vuelta\b|criterium\s+du\s+dauphine|critérium\s+du\s+dauphiné|maillot\s+jaune|peloton|cyclisme|cycliste|pogacar|vingegaard|van\s+der\s+poel|van\s+aert|evenepoel|alaphilippe)\b/.test(n)) return mk('Cyclisme','Cyclisme','cycling_title');
    if (/\b(leon\s+marchand|léon\s+marchand|manaudou|natation|swimming|world\s+aquatics|nage\s+libre|brasse|papillon)\b/.test(n)) return mk('Natation','Natation','swimming_title');
    if (/\b(mbappe|mbappé|psg\b|ligue\s+1\b|football|foot\b|coupe\s+de\s+france\s+football|equipe\s+de\s+france\s+de\s+football)\b/.test(n)) return mk('Football','Football','football_title');
    if (/\b(nba\b|wembanyama|wemby\b|eurobasket|basket\b|basketball)\b/.test(n)) return mk('Basket-ball','Basket-ball','basket_title');
    if (/\b(handball|mondial\s+de\s+handball|euro\s+de\s+handball|ligue\s+des\s+champions\s+handball)\b/.test(n)) return mk('Handball','Handball','handball_title');
    return null;
  }catch(e){ return null; }
}
function ftvClassificationContradictsTitle(input, cls){
  try{
    const hard = ftvHardTitleClassification(input);
    if (!hard || !cls) return null;
    if (cls.s !== hard.s || (hard.c && cls.c !== hard.c && hard._debug?.rule !== 'rugby_title_entity')) return hard;
    return null;
  }catch(e){ return null; }
}

// V16 PERFORMANCE : la classification est coûteuse car elle parcourt tous les sports,
// compétitions et mots-clés. On la met en cache par objet vidéo pour éviter de
// la recalculer à chaque clic, recherche, export ou rendu de ligne.
const __FTV_CLASSIFY_RAW = window.classify;
let __FTV_CLASSIFY_CACHE = new WeakMap();

// Couche cache + corrections manuelles.
window.classify = function(input, tags=[], description='') {
  const canCache = input && typeof input === 'object' && (!tags || tags.length === 0) && !description;

  const videoId = input && typeof input === 'object' ? (input.id || input.videoId) : null;
  if (videoId) {
    const ov = window.FTVLearning.getOverride(videoId);
    if (ov && ov.sport) {
      const sp = (window.SR_SCORED || []).find(s => s.s === ov.sport);
      const result = {
        s: ov.sport,
        c: ov.comp || 'Correction manuelle',
        bg: sp?.bg || '#F5F5F5',
        fg: sp?.fg || '#5A5A5A',
        i: sp?.i || '✋',
        _debug: {confidence:'manual_override', score:0, kws:['override:'+ov.sport]}
      };
      if (canCache) __FTV_CLASSIFY_CACHE.set(input, result);
      return result;
    }
  }

  // Les verrous de titre doivent passer AVANT le cache. Sinon un ancien __ftv_cls
  // ou un cache WeakMap peut maintenir une vidéo rugby dans Tennis/Roland-Garros.
  const hardLocked = ftvHardTitleClassification(input) || ftvTitleLockedClassification(input);
  if (hardLocked) {
    if (canCache) __FTV_CLASSIFY_CACHE.set(input, hardLocked);
    return hardLocked;
  }

  if (canCache && __FTV_CLASSIFY_CACHE.has(input)) {
    const cached = __FTV_CLASSIFY_CACHE.get(input);
    const corrected = ftvClassificationContradictsTitle(input, cached);
    if (!corrected) return cached;
    __FTV_CLASSIFY_CACHE.set(input, corrected);
    return corrected;
  }

  let result = __FTV_CLASSIFY_RAW(input, tags, description);
  result = ftvFixTennisShortMisclassification(input, result);
  const corrected = ftvClassificationContradictsTitle(input, result);
  if (corrected) result = corrected;

  if (canCache) __FTV_CLASSIFY_CACHE.set(input, result);
  return result;
};

// Pour invalider le cache de classification après un override manuel ou un
// correction manuelle. À appeler depuis l'UI.
window.invalidateClassifyCache = function(){
  __FTV_CLASSIFY_CACHE = new WeakMap();
};


// Compat : certaines parties du dashboard lisent encore window.SR.
// On fournit une vue dégradée pour qu'un éventuel code legacy continue de
// fonctionner — mais c'est SR_SCORED qui pilote la classification.
window.SR = window.SR_SCORED.map(sp => ({
  s: sp.s, i: sp.i, bg: sp.bg, fg: sp.fg,
  comps: sp.comps.map(c => ({
    n: c.n,
    k: [...(c.strong||[]), ...(c.medium||[]), ...(c.weak||[])]
  }))
}));

// ─── CLASSIFICATION SHORT vs VIDEO ───────────────────────────────────────────
// Règles métier FTV Sport (les titres sont très bien formatés sur cette chaîne) :
//   - Pattern « [Compétition] : [Titre de la vidéo] » → vidéo classique.
//     On accepte aussi les variantes « | », « - » et « — » comme séparateurs
//     de tête après un nom de compétition.
//   - Hashtag (#xxx) ou emoji dans le titre → quasi-certain : c'est un short.
//   - Sinon → short par défaut (les vidéos longues bien classées ont presque
//     toujours le pattern « Compet : Titre »).
// La durée n'est utilisée qu'en garde-fou : si la vidéo dépasse 3 minutes,
// on la garde en « video » même sans pattern (résumés sans deux-points).
// Les lives restent détectés via liveStreamingDetails côté API.

// Regex emoji compatible avec les navigateurs modernes.
try { window.FTV_EMOJI_RE = new RegExp('[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{1F000}-\\u{1F2FF}]','u'); } catch(e) { window.FTV_EMOJI_RE = /[☀-➿]/; }

function ftvHasTitleHashtag(title){ return /#[\w\u00C0-\u017F]+/.test(String(title||'')); }
function ftvHasTitleEmoji(title){ return window.FTV_EMOJI_RE.test(String(title||'')); }
function ftvExplicitLongTitle(title){
  return /resume complet|résumé complet|integralite|intégralité|match complet|course complete|course complète|replay|documentaire|magazine|interview complete|interview complète|conférence de presse|conference de presse|le match en intégralité|le match en integralite/i.test(String(title||''));
}
function ftvStructuredLongVideoTitle(title){
  const t = String(title||'').trim();
  return /^[^:|—–]{3,}\s+[:|—–]\s*\S/.test(t) || /^[^:|—–\-]{3,}\s+-\s+\S/.test(t);
}

window.classifyType = function(title, durationSecs, isLive) {
  if (isLive) return 'live';
  const t = String(title||'').trim();
  const secs = Number(durationSecs) || 0;
  const hasShortWord = /(^|\s)#?shorts?(\s|$)/i.test(t);
  const hasHash = ftvHasTitleHashtag(t);
  const hasEmoji = ftvHasTitleEmoji(t);
  const explicitLong = ftvExplicitLongTitle(t);
  const structuredLong = ftvStructuredLongVideoTitle(t);

  if (hasShortWord) return 'short';
  if (explicitLong) return 'video';
  if (hasHash || hasEmoji) {
    if (!secs || secs < 240) return 'short';
    if (secs >= 240 && structuredLong) return 'video';
    if (secs >= 600) return 'video';
    return 'short';
  }
  if (secs > 0 && secs < 180) return structuredLong && secs >= 150 ? 'video' : 'short';
  if (structuredLong) return 'video';
  if (secs >= 180) return 'video';
  return 'short';
};

window.ftvResolveContentType = function(video, fallbackLive=false){
  if (!video) return 'video';
  const title = video.title || video.snippet?.title || '';
  const dur = window.getVideoDurationSecs ? window.getVideoDurationSecs(video) : (window.getDurationSecs ? window.getDurationSecs(video.duration || video.contentDetails?.duration) : 0);
  const live = fallbackLive || video.type === 'live' || !!video.liveStreamingDetails?.actualStartTime;
  return window.classifyType(title, dur, live);
};

// ─── DURÉE ────────────────────────────────────────────────────────────────────
window.getDurationSecs = function(dur) {
  const m = (dur||'').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return parseInt(m[1]||0)*3600 + parseInt(m[2]||0)*60 + parseInt(m[3]||0);
};

// ─── DATE D'UNE VIDÉO MOCK ───────────────────────────────────────────────────
// Dates réalistes 2025 par compétition
const PREFIX_DATES = [
  {p:'hb_',   r:['2025-01-14','2025-02-02']},
  {p:'vg_',   r:['2025-01-05','2025-02-10']},
  {p:'ski_',  r:['2025-01-10','2025-03-22']},
  {p:'biat_', r:['2025-01-08','2025-03-16']},
  {p:'6n_',   r:['2025-02-01','2025-03-15']},
  {p:'ju_',   r:['2025-02-07','2025-06-15']},
  {p:'cyc_v02',d:'2025-03-08'},
  {p:'cyc_v03',d:'2025-03-22'},
  {p:'cyc_v04',d:'2025-04-06'},
  {p:'cyc_s01',d:'2025-04-13'},
  {p:'cyc_s02',d:'2025-06-07'},
  {p:'prx_',  d:'2025-04-06'},
  {p:'cyc_v01',d:'2025-04-27'},
  {p:'rg_',   r:['2025-05-26','2025-06-08']},
  {p:'dav_',  r:['2025-09-10','2025-09-14']},
  {p:'cc_',   r:['2025-04-20','2025-05-24']},
  {p:'t14_',  r:['2025-01-05','2025-06-28']},
  {p:'ff_',   r:['2025-03-22','2025-11-15']},
  {p:'tdf_',  r:['2025-07-05','2025-07-27']},
  {p:'nat_',  r:['2025-07-14','2025-07-27']},
  {p:'ath_',  r:['2025-09-05','2025-09-21']},
  {p:'bk_',   r:['2025-08-28','2025-09-14']},
  {p:'vlt_',  r:['2025-08-23','2025-09-14']},
];

window.getVideoDate = function(id) {
  for (const {p, d, r} of PREFIX_DATES) {
    if (id.startsWith(p)) {
      if (d) return new Date(d);
      const s = new Date(r[0]), e = new Date(r[1]);
      return new Date((s.getTime() + e.getTime()) / 2);
    }
  }
  return new Date('2025-06-15');
};

// ─── BUILD SPORTS ─────────────────────────────────────────────────────────────
window.buildSports = function(videos) {
  const data = {};
  videos.forEach(v => {
    let cls = v && v.__ftv_cls ? v.__ftv_cls : window.classify(v);
    if (v && !v.__ftv_cls) {
      try { Object.defineProperty(v,'__ftv_cls',{value:cls, configurable:true, enumerable:false}); } catch(e) {}
    }
    const durationSecs = window.getVideoDurationSecs ? window.getVideoDurationSecs(v) : window.getDurationSecs(v.duration);
    if (v && window.ftvResolveContentType) {
      try { v.type = window.ftvResolveContentType(v); } catch(e) {}
    }
    if (!data[cls.s]) data[cls.s] = {i:cls.i, bg:cls.bg, fg:cls.fg, comps:{}, total:0, views:0, duration:0};
    if (!data[cls.s].comps[cls.c]) data[cls.s].comps[cls.c] = {videos:[], views:0, duration:0};
    data[cls.s].comps[cls.c].videos.push(v);
    data[cls.s].comps[cls.c].views += v.views;
    data[cls.s].comps[cls.c].duration += durationSecs;
    data[cls.s].total++;
    data[cls.s].views += v.views;
    data[cls.s].duration += durationSecs;
  });
  return data;
};

// ─── MODE PRÉSENTATION CLIENT : SCOPES ÉVÉNEMENTIELS ───────────────────────
window.ftvPresentationEventKey = function(v) {
  try {
    const cls = v && v.__ftv_cls ? v.__ftv_cls : window.classify(v);
    if (v && !v.__ftv_cls) {
      try { Object.defineProperty(v,'__ftv_cls',{value:cls, configurable:true, enumerable:false}); } catch(e) {}
    }
    return `${cls.s}|||${cls.c}`;
  } catch(e) {
    return 'Autres|||Non classé';
  }
};
window.ftvPresentationEventLabel = function(key) {
  const parts = String(key || '').split('|||');
  return `${parts[0] || 'Événement'} — ${parts[1] || 'Général'}`;
};
window.ftvBuildPresentationEvents = function(videos) {
  const map = new Map();
  (videos || []).forEach(v => {
    const key = window.ftvPresentationEventKey(v);
    const item = map.get(key) || { key, label: window.ftvPresentationEventLabel(key), views: 0, count: 0 };
    item.views += Number(v.views || 0);
    item.count += 1;
    map.set(key, item);
  });
  return Array.from(map.values()).sort((a,b) => (b.views || 0) - (a.views || 0));
};

// ─── FORMATAGE ────────────────────────────────────────────────────────────────
window.fmt = function(n) {
  if (n >= 1e9) return (n/1e9).toFixed(1)+'Md';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return Math.round(n/1000)+'K';
  return String(Math.round(n));
};
window.fmtFull = function(n) { return Math.round(n).toLocaleString('fr-FR'); };
window.fmtDate = function(ts) {
  return new Date(ts).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
};
window.fmtDateShort = function(d) {
  return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});
};

// ─── CHAÎNES + CACHE ──────────────────────────────────────────────────────────
window.CHANNEL_CONFIGS = {
  sport: {
    key:'sport',
    label:'SPORT',
    subtitle:'YouTube Analytics',
    handle:'ftvsport',
    channelId:'UCRm-DLbhzojKd10edotYxMg',
    url:'https://www.youtube.com/@ftvsport',
    cacheKey:'ftv_youtube_cache_v28_sport',
    legacyCacheKeys:['ftv_youtube_cache_v26_sport','ftv_youtube_cache_v19_sport','ftvsport_videos_cache']
  },
  francetv: {
    key:'francetv',
    label:'FRANCE TV',
    subtitle:'YouTube Analytics',
    handle:'francetv',
    channelId:null,
    url:'https://www.youtube.com/@francetv',
    cacheKey:'ftv_youtube_cache_v88_francetv',
    legacyCacheKeys:[]
  },
  franceinfo: {
    key:'franceinfo',
    label:'FRANCEINFO',
    subtitle:'YouTube Analytics',
    handle:'franceinfo',
    channelId:null,
    url:'https://www.youtube.com/@franceinfo',
    cacheKey:'ftv_youtube_cache_v88_franceinfo',
    legacyCacheKeys:[]
  },
  francetvculture: {
    key:'francetvculture',
    label:'CULTURE',
    subtitle:'YouTube Analytics',
    handle:'francetvculture',
    channelId:null,
    url:'https://www.youtube.com/@francetvculture',
    cacheKey:'ftv_youtube_cache_v88_francetvculture',
    legacyCacheKeys:[]
  },
  slash: {
    key:'slash',
    label:'SLASH',
    subtitle:'YouTube Analytics',
    handle:'slash_ftv',
    channelId:null,
    url:'https://www.youtube.com/@slash_ftv',
    cacheKey:'ftv_youtube_cache_v88_slash',
    legacyCacheKeys:[]
  }
};
window.DEFAULT_CHANNEL_KEY = 'sport';
window.getChannelConfig = function(channelKey) {
  return window.CHANNEL_CONFIGS[channelKey] || window.CHANNEL_CONFIGS[window.DEFAULT_CHANNEL_KEY];
};
window.getCacheKey = function(channelKey) {
  return window.getChannelConfig(channelKey).cacheKey || `ftv_youtube_cache_v28_${channelKey || window.DEFAULT_CHANNEL_KEY}`;
};
window.getCacheKeys = function(channelKey) {
  const cfg = window.getChannelConfig(channelKey);
  return [cfg.cacheKey, ...(cfg.legacyCacheKeys||[])].filter(Boolean);
};
window.ftvCacheBelongsToChannel = function(cacheObj, channelKey) {
  const videos = cacheObj && Array.isArray(cacheObj.videos) ? cacheObj.videos : [];
  if (!videos.length) return false;
  const checked = videos.slice(0, Math.min(25, videos.length));
  return checked.every(v => !v.channelKey || v.channelKey === channelKey);
};
window.ftvCacheHasMultiYearCoverage = function(cacheObj) {
  const videos = cacheObj && Array.isArray(cacheObj.videos) ? cacheObj.videos : [];
  const years = new Set(videos.map(v => {
    const d = v && v.publishedAt ? new Date(v.publishedAt) : null;
    return d && !Number.isNaN(d.getTime()) ? d.getFullYear() : null;
  }).filter(Boolean));
  return years.size >= 2;
};
// Compatibilité avec les anciennes versions qui lisaient window.CACHE_KEY.
window.CACHE_KEY = window.getCacheKey(window.DEFAULT_CHANNEL_KEY);

// Cache conservateur : on garde la base stable de la v36, mais on allège
// les sauvegardes pour éviter que FRANCE TV dépasse le quota localStorage.
// Aucun changement d'architecture UI ici : uniquement persistance + robustesse.
window.CACHE_SCHEMA_VERSION = 'v111';
window.CACHE_DESC_LIMIT = 1400;
window.CACHE_TAG_LIMIT = 30;
window.CACHE_MAX_RAW_BYTES = 4500000;
window.FRANCETV_FETCH_YEARS = null;

function slimVideoForCache(v, descLimit=window.CACHE_DESC_LIMIT, tagLimit=window.CACHE_TAG_LIMIT) {
  if(!v || typeof v !== 'object') return v;
  return {
    id: v.id,
    channelKey: v.channelKey,
    channelTitle: v.channelTitle,
    title: v.title || '',
    description: descLimit > 0 ? String(v.description || '').slice(0, descLimit) : '',
    tags: Array.isArray(v.tags) ? v.tags.slice(0, tagLimit) : [],
    views: Number(v.views || 0),
    likes: Number(v.likes || 0),
    comments: Number(v.comments || 0),
    duration: v.duration || '',
    publishedAt: v.publishedAt || '',
    type: v.type || 'video'
  };
}
function slimVideosForCache(videos, descLimit=window.CACHE_DESC_LIMIT, tagLimit=window.CACHE_TAG_LIMIT) {
  return (Array.isArray(videos) ? videos : []).map(v => slimVideoForCache(v, descLimit, tagLimit));
}
window.getDefaultFetchStartDate = function(channelKey) {
  // v52 : aucune chaîne n'est limitée à l'année courante.
  // SPORT, FRANCE TV, FRANCEINFO, CULTURE et SLASH peuvent charger leurs archives complètes.
  // La stabilité est assurée séparément par le cache allégé et la protection anti-cache trop lourd.
  return undefined;
};
window.saveCache = function(videos, channelKey=window.DEFAULT_CHANNEL_KEY) {
  // v112 : pas de cache local pour les vidéos. La seule source de vérité est la console admin / Supabase.
  return true;
};
window.loadCache = function(channelKey=window.DEFAULT_CHANNEL_KEY) {
  // v112 : le dashboard client ne lit jamais d'anciens snapshots localStorage.
  return null;
};

// ─── API ──────────────────────────────────────────────────────────────────────
const YT_HTTP_CACHE_NAME = 'ftv-youtube-http-cache-v1';
const YT_HTTP_CACHE_TTL_MS = 0; // v112 : aucun cache navigateur pour les données YouTube
try { if ('caches' in window) caches.delete(YT_HTTP_CACHE_NAME); } catch(e) {}

async function cachedApiJson(url, { force = false } = {}) {
  const fullUrl = new URL(url, window.location.origin).toString();
  const sep = fullUrl.includes('?') ? '&' : '?';
  const liveUrl = fullUrl + sep + '_live=' + Date.now();
  const res = await fetch(liveUrl, { cache: 'no-store', headers: { 'Cache-Control': 'no-store' } });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch (e) { data = { error: text || 'Réponse API invalide' }; }
  if (!res.ok || data.error) throw new Error(data.error?.message || data.error || 'Erreur API YouTube');
  return data;
}

async function fetchJson(url) {
  return cachedApiJson(url);
}

async function resolveUploadsPlaylist(key, channelConfig) {
  const cfg = channelConfig || window.getChannelConfig(window.DEFAULT_CHANNEL_KEY);
  const filters = [];
  // Pour france.tv sport, on garde l'ID historique en priorité.
  // Pour les autres chaînes, le handle YouTube permet d'éviter de hardcoder l'ID.
  if (cfg.channelId) filters.push(`id=${encodeURIComponent(cfg.channelId)}`);
  if (cfg.handle) {
    const handle = String(cfg.handle).replace(/^@/, '');
    filters.push(`forHandle=${encodeURIComponent('@' + handle)}`);
  }

  let lastError = null;
  for (const filter of filters) {
    try {
      const data = await fetchJson(`/api/youtube-v3?endpoint=channels&part=contentDetails,snippet&${filter}&key=${key}`);
      const item = data.items?.[0];
      const uploadsId = item?.contentDetails?.relatedPlaylists?.uploads;
      if (uploadsId) return {uploadsId, channelTitle:item.snippet?.title || cfg.label};
    } catch(e) {
      lastError = e;
    }
  }
  if (lastError) throw lastError;
  throw new Error(`Chaîne introuvable pour ${cfg.url || cfg.label}`);
}

// fetchAll : récupère toutes les vidéos sans restriction d'année.
// startDate (optionnel) : Date — arrête la pagination dès qu'on dépasse cette date vers le passé.
window.fetchAll = async function(key, onProgress, startDate, channelKeyOrConfig=window.DEFAULT_CHANNEL_KEY) {
  const cfg = typeof channelKeyOrConfig === 'string'
    ? window.getChannelConfig(channelKeyOrConfig)
    : (channelKeyOrConfig || window.getChannelConfig(window.DEFAULT_CHANNEL_KEY));

  onProgress(`Récupération de la playlist — ${cfg.label}…`);
  const {uploadsId, channelTitle} = await resolveUploadsPlaylist(key, cfg);

  const acc = []; let pt = '', page = 0;
  do {
    page++;
    // Laisse le navigateur respirer entre deux pages pour éviter l'effet interface figée.
    if(page>1) await new Promise(resolve=>setTimeout(resolve,0));
    onProgress(`${cfg.label} — page ${page} · ${acc.length} vidéos récupérées…`);
    const d = await cachedApiJson(`/api/youtube-v3?endpoint=playlistItems&part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=50${pt?'&pageToken='+pt:''}&key=${key}`);
    const items = d.items||[];
    let stop = false;
    const ids = [];
    for (const item of items) {
      const pub = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || '';
      const vid = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      if (!vid) continue;
      // Si startDate fourni, s'arrêter dès que la vidéo est antérieure.
      if (startDate && pub && new Date(pub) < startDate) { stop = true; break; }
      ids.push(vid);
    }
    if (ids.length) {
      onProgress(`${cfg.label} — page ${page} · enrichissement de ${ids.length} vidéos…`);
      const sd = await cachedApiJson(`/api/youtube-v3?endpoint=videos&part=statistics,contentDetails,snippet,liveStreamingDetails&id=${ids.join(',')}&key=${key}`);
      (sd.items||[]).forEach(v => {
        const hasLive = !!(v.liveStreamingDetails?.actualStartTime);
        const dur = window.getDurationSecs(v.contentDetails.duration);
        acc.push({
          id: v.id,
          channelKey: cfg.key,
          channelTitle,
          title: v.snippet.title,
          description: v.snippet.description || '',
          tags: (v.snippet.tags||[]).map(x=>String(x).toLowerCase()),
          views: parseInt(v.statistics.viewCount||'0',10),
          likes: parseInt(v.statistics.likeCount||'0',10),
          comments: parseInt(v.statistics.commentCount||'0',10),
          duration: v.contentDetails.duration,
          publishedAt: v.snippet.publishedAt,
          type: window.classifyType(v.snippet.title, dur, hasLive),
        });
      });
    }
    pt = d.nextPageToken||'';
    if (stop) break;
  } while (pt);
  onProgress(`Terminé — ${acc.length} vidéos analysées pour ${cfg.label}`);
  return acc;
};


// Snapshot serveur : affichage instantané quand le cache Vercel est chaud.
window.fetchChannelSnapshot = async function(channelKey, { force = false } = {}) {
  const requested = channelKey || window.DEFAULT_CHANNEL_KEY;
  const url = `/api/dashboard-data?channel=${encodeURIComponent(requested)}&schema=${encodeURIComponent(window.CACHE_SCHEMA_VERSION || 'v112')}`;
  const data = await cachedApiJson(url, { force });
  if (!data || !Array.isArray(data.videos)) throw new Error(data?.error || 'Snapshot serveur indisponible.');
  if (data.channel && data.channel !== requested) {
    throw new Error(`Snapshot incohérent: ${data.channel} reçu pour ${requested}.`);
  }
  data.videos = data.videos.map(v => ({...v, channelKey: requested}));
  return data;
};

// Refresh live léger : met à jour uniquement vues/likes/commentaires publics sans refaire toute la classification.
window.FTV_LIVE_STATS_LIMIT = 180;
window.FTV_DEFER_CACHE_WRITES = true;
window.runWhenIdle = function(fn, timeout = 2500) {
  try {
    if ('requestIdleCallback' in window) return window.requestIdleCallback(fn, { timeout });
  } catch(e) {}
  return setTimeout(fn, 80);
};

// Refresh live léger : on n'actualise plus toute la chaîne au démarrage.
// On cible les vidéos les plus récentes + les plus vues, ce qui réduit fortement
// le temps de chargement et les appels API sans casser le snapshot complet.
window.getPriorityLiveVideos = function(videos, limit = window.FTV_LIVE_STATS_LIMIT || 180) {
  const arr = Array.isArray(videos) ? videos.filter(v => v && v.id) : [];
  const byRecent = [...arr].sort((a,b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)).slice(0, Math.ceil(limit * 0.65));
  const byViews = [...arr].sort((a,b) => (Number(b.views)||0) - (Number(a.views)||0)).slice(0, Math.ceil(limit * 0.45));
  const map = new Map();
  [...byRecent, ...byViews].forEach(v => { if (!map.has(v.id) && map.size < limit) map.set(v.id, v); });
  return [...map.values()];
};
window.refreshPublicStatsLive = async function(videos, onProgress, options = {}) {
  const arr = Array.isArray(videos) ? videos : [];
  const priority = window.getPriorityLiveVideos(arr, options.limit || window.FTV_LIVE_STATS_LIMIT || 180);
  const ids = priority.map(v => v.id).filter(Boolean);
  if (!ids.length) return arr;
  const statsById = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    if (onProgress && options.showProgress) onProgress(`Actualisation live des vues publiques ${Math.min(i + 50, ids.length)}/${ids.length}…`);
    const r = await fetch(`/api/live-stats?ids=${encodeURIComponent(chunk.join(','))}`, { cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) throw new Error(data.error || 'Refresh live stats impossible.');
    Object.assign(statsById, data.stats || {});
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return arr.map(v => statsById[v.id] ? { ...v, ...statsById[v.id] } : v);
};

// ─── DONNÉES MOCK ─────────────────────────────────────────────────────────────
window.MOCK_VIDEOS = [
  // ── CYCLISME : Tour de France
  {id:'tdf_v01',title:'Tour de France 2025 — Étape 1 résumé Grand Départ Lille',views:312000,duration:'PT28M',type:'video'},
  {id:'tdf_v02',title:'Tour de France 2025 — Étape 8 résumé Pogacar attaque',views:285000,duration:'PT32M',type:'video'},
  {id:'tdf_v03',title:'Tour de France 2025 — Étape 10 arrivée au sommet',views:198000,duration:'PT30M',type:'video'},
  {id:'tdf_v04',title:'Tour de France 2025 — Étape 16 chrono résumé',views:421000,duration:'PT25M',type:'video'},
  {id:'tdf_v05',title:'Tour de France 2025 — Étape 17 résumé arrivée Alpe d\'Huez',views:1840000,duration:'PT35M',type:'video'},
  {id:'tdf_v06',title:'Tour de France 2025 — Étape 20 avant-dernière étape résumé',views:310000,duration:'PT28M',type:'video'},
  {id:'tdf_v07',title:'Tour de France 2025 — Étape 21 Champs-Élysées résumé final',views:2100000,duration:'PT40M',type:'video'},
  {id:'tdf_v08',title:'Tour de France 2025 — Résumé de la semaine 1',views:145000,duration:'PT18M',type:'video'},
  {id:'tdf_v09',title:'Tour de France 2025 — Résumé de la semaine 2',views:132000,duration:'PT18M',type:'video'},
  {id:'tdf_v10',title:'Tour de France 2025 — Présentation du parcours complet',views:88000,duration:'PT15M',type:'video'},
  {id:'tdf_v11',title:'Tour de France 2025 — Top 5 des plus belles étapes',views:174000,duration:'PT12M',type:'video'},
  {id:'tdf_v12',title:'Tour de France 2025 — Interview Vingegaard après victoire',views:96000,duration:'PT8M',type:'video'},
  {id:'tdf_s01',title:'Tour de France 2025 — La chute de la descente #shorts',views:485000,duration:'PT52S',type:'short'},
  {id:'tdf_s02',title:'Tour de France 2025 — Attaque de Pogacar km 0 #shorts',views:312000,duration:'PT55S',type:'short'},
  {id:'tdf_s03',title:'Tour de France 2025 — Sprint final étape 5 #shorts',views:218000,duration:'PT48S',type:'short'},
  {id:'tdf_s04',title:'Tour de France 2025 — Le maillot jaune résumé #shorts',views:145000,duration:'PT58S',type:'short'},
  {id:'tdf_s05',title:'TDF 2025 record du chrono #shorts',views:390000,duration:'PT50S',type:'short'},
  {id:'tdf_l01',title:'Tour de France 2025 — Étape 17 Live direct',views:95000,duration:'PT5H',type:'live'},
  {id:'tdf_l02',title:'Tour de France 2025 — Étape 21 Champs-Élysées Live',views:142000,duration:'PT4H',type:'live'},
  {id:'tdf_l03',title:'Tour de France 2025 — Étape 16 CLM Live direct',views:78000,duration:'PT4H',type:'live'},
  // ── CYCLISME : Paris-Roubaix
  {id:'prx_v01',title:'Paris-Roubaix 2025 — Résumé complet van der Poel',views:680000,duration:'PT32M',type:'video'},
  {id:'prx_v02',title:'Paris-Roubaix 2025 — Les secteurs pavés résumé',views:185000,duration:'PT20M',type:'video'},
  {id:'prx_v03',title:'Paris-Roubaix 2025 — Arrivée vélodrome résumé',views:312000,duration:'PT15M',type:'video'},
  {id:'prx_s01',title:'Paris-Roubaix 2025 — Chute dans les pavés #shorts',views:740000,duration:'PT55S',type:'short'},
  {id:'prx_s02',title:'Paris-Roubaix 2025 — Solo final #shorts',views:298000,duration:'PT52S',type:'short'},
  {id:'prx_l01',title:'Paris-Roubaix 2025 — Live direct course complète',views:64000,duration:'PT7H',type:'live'},
  // ── CYCLISME : Vuelta
  {id:'vlt_v01',title:'Vuelta 2025 — Résumé étape reine',views:145000,duration:'PT25M',type:'video'},
  {id:'vlt_v02',title:'Vuelta 2025 — Résumé dernière étape',views:112000,duration:'PT22M',type:'video'},
  {id:'vlt_v03',title:'Vuelta 2025 — Top 5 étapes',views:88000,duration:'PT14M',type:'video'},
  {id:'vlt_s01',title:'Vuelta 2025 — Sprint pour la victoire #shorts',views:165000,duration:'PT55S',type:'short'},
  // ── CYCLISME : Classiques
  {id:'cyc_v01',title:'Liège-Bastogne-Liège 2025 — Résumé complet',views:195000,duration:'PT28M',type:'video'},
  {id:'cyc_v02',title:'Strade Bianche 2025 — Résumé',views:142000,duration:'PT22M',type:'video'},
  {id:'cyc_v03',title:'Milan-San Remo 2025 — Résumé',views:168000,duration:'PT25M',type:'video'},
  {id:'cyc_v04',title:'Tour des Flandres 2025 — Résumé',views:152000,duration:'PT25M',type:'video'},
  {id:'cyc_s01',title:'Amstel Gold Race 2025 sprint final #shorts',views:98000,duration:'PT52S',type:'short'},
  {id:'cyc_s02',title:'Critérium du Dauphiné 2025 #shorts',views:74000,duration:'PT55S',type:'short'},
  // ── RUGBY : Six Nations
  {id:'6n_v01',title:'Six Nations 2025 — France vs Irlande résumé',views:1250000,duration:'PT22M',type:'video'},
  {id:'6n_v02',title:'Six Nations 2025 — France vs Angleterre résumé',views:980000,duration:'PT22M',type:'video'},
  {id:'6n_v03',title:'Six Nations 2025 — France vs Écosse résumé',views:620000,duration:'PT20M',type:'video'},
  {id:'6n_v04',title:'Six Nations 2025 — France vs Pays de Galles résumé',views:450000,duration:'PT20M',type:'video'},
  {id:'6n_v05',title:'Six Nations 2025 — France vs Italie résumé',views:385000,duration:'PT18M',type:'video'},
  {id:'6n_v06',title:'Six Nations 2025 — Résumé du Tournoi complet',views:510000,duration:'PT30M',type:'video'},
  {id:'6n_v07',title:'Six Nations 2025 — Top essais du tournoi',views:290000,duration:'PT12M',type:'video'},
  {id:'6n_s01',title:'Six Nations 2025 — L\'essai de l\'année #shorts',views:680000,duration:'PT55S',type:'short'},
  {id:'6n_s02',title:'Six Nations 2025 — Grégory Alldritt en feu #shorts',views:420000,duration:'PT52S',type:'short'},
  {id:'6n_s03',title:'Six Nations 2025 — Dupont dévastateur #shorts',views:545000,duration:'PT58S',type:'short'},
  {id:'6n_s04',title:'Six Nations 2025 — France champion #shorts',views:312000,duration:'PT50S',type:'short'},
  {id:'6n_l01',title:'Six Nations 2025 — France vs Irlande Live direct',views:185000,duration:'PT2H30M',type:'live'},
  {id:'6n_l02',title:'Six Nations 2025 — France vs Angleterre Live',views:142000,duration:'PT2H30M',type:'live'},
  {id:'6n_l03',title:'Six Nations 2025 — France vs Écosse Live',views:98000,duration:'PT2H30M',type:'live'},
  {id:'6n_l04',title:'Six Nations 2025 — France vs Pays de Galles Live',views:78000,duration:'PT2H30M',type:'live'},
  {id:'6n_l05',title:'Six Nations 2025 — France vs Italie Live',views:65000,duration:'PT2H30M',type:'live'},
  // ── RUGBY : Top 14
  {id:'t14_v01',title:'Top 14 2025 — Finale résumé',views:720000,duration:'PT28M',type:'video'},
  {id:'t14_v02',title:'Top 14 2025 — Demi-finale résumé',views:410000,duration:'PT25M',type:'video'},
  {id:'t14_v03',title:'Top 14 2025 — J1 résumé journée',views:125000,duration:'PT18M',type:'video'},
  {id:'t14_v04',title:'Top 14 2025 — J10 résumé journée',views:98000,duration:'PT18M',type:'video'},
  {id:'t14_v05',title:'Top 14 2025 — J22 résumé journée',views:112000,duration:'PT18M',type:'video'},
  {id:'t14_s01',title:'Top 14 2025 — L\'essai de la saison #shorts',views:285000,duration:'PT55S',type:'short'},
  {id:'t14_s02',title:'Top 14 finale : la dernière action #shorts',views:198000,duration:'PT52S',type:'short'},
  {id:'t14_l01',title:'Top 14 2025 — Finale Live direct',views:112000,duration:'PT2H30M',type:'live'},
  {id:'t14_l02',title:'Top 14 2025 — Demi-finale Live',views:78000,duration:'PT2H30M',type:'live'},
  // ── RUGBY : Champions Cup
  {id:'cc_v01',title:'Champions Cup 2025 — Finale résumé',views:485000,duration:'PT25M',type:'video'},
  {id:'cc_v02',title:'Champions Cup 2025 — Demi-finale Toulouse résumé',views:312000,duration:'PT22M',type:'video'},
  {id:'cc_s01',title:'Champions Cup 2025 — Meilleur moment #shorts',views:175000,duration:'PT55S',type:'short'},
  {id:'cc_l01',title:'Champions Cup 2025 — Finale Live',views:68000,duration:'PT2H30M',type:'live'},
  // ── TENNIS : Roland-Garros
  {id:'rg_v01',title:'Roland-Garros 2025 — Finale messieurs résumé',views:1680000,duration:'PT35M',type:'video'},
  {id:'rg_v02',title:'Roland-Garros 2025 — Finale dames résumé',views:890000,duration:'PT32M',type:'video'},
  {id:'rg_v03',title:'Roland-Garros 2025 — Demi-finale messieurs résumé',views:620000,duration:'PT28M',type:'video'},
  {id:'rg_v04',title:'Roland-Garros 2025 — Quart de finale résumé',views:380000,duration:'PT25M',type:'video'},
  {id:'rg_v05',title:'Roland-Garros 2025 — 3e tour résumé',views:215000,duration:'PT22M',type:'video'},
  {id:'rg_v06',title:'Roland-Garros 2025 — Top 10 points du tournoi',views:445000,duration:'PT14M',type:'video'},
  {id:'rg_s01',title:'Roland-Garros 2025 — Le point du tournoi #shorts',views:820000,duration:'PT55S',type:'short'},
  {id:'rg_s02',title:'Roland-Garros 2025 — Smash incroyable #shorts',views:512000,duration:'PT52S',type:'short'},
  {id:'rg_s03',title:'Roland-Garros 2025 — Victoire finale #shorts',views:385000,duration:'PT58S',type:'short'},
  {id:'rg_l01',title:'Roland-Garros 2025 — Finale messieurs Live',views:198000,duration:'PT4H',type:'live'},
  {id:'rg_l02',title:'Roland-Garros 2025 — Finale dames Live',views:145000,duration:'PT3H',type:'live'},
  // ── TENNIS : Coupe Davis
  {id:'dav_v01',title:'Coupe Davis 2025 — France en demi-finale résumé',views:285000,duration:'PT22M',type:'video'},
  {id:'dav_v02',title:'Coupe Davis 2025 — Finale résumé',views:198000,duration:'PT20M',type:'video'},
  {id:'dav_s01',title:'Coupe Davis 2025 — Match décisif #shorts',views:142000,duration:'PT55S',type:'short'},
  {id:'dav_l01',title:'Coupe Davis 2025 — Demi-finale Live',views:58000,duration:'PT3H',type:'live'},
  // ── FOOTBALL
  {id:'ff_v01',title:'France vs Italie 2025 — Résumé Ligue des Nations',views:780000,duration:'PT18M',type:'video'},
  {id:'ff_v02',title:'France vs Espagne 2025 — Résumé Ligue des Nations',views:920000,duration:'PT20M',type:'video'},
  {id:'ff_v03',title:'France vs Allemagne 2025 — Résumé amical équipe de france football',views:645000,duration:'PT18M',type:'video'},
  {id:'ff_v04',title:'France vs Maroc 2025 — Résumé amical bleus foot',views:498000,duration:'PT18M',type:'video'},
  {id:'ff_v05',title:'Équipe de France football 2025 — Top buts de l\'année',views:312000,duration:'PT12M',type:'video'},
  {id:'ff_s01',title:'But de Mbappé en LDN bleus foot #shorts',views:1120000,duration:'PT52S',type:'short'},
  {id:'ff_s02',title:'Dembélé dribble de folie France football 2025 #shorts',views:680000,duration:'PT55S',type:'short'},
  {id:'ff_s03',title:'France qualifiée pour le Mondial 2026 foot #shorts',views:490000,duration:'PT58S',type:'short'},
  {id:'ff_l01',title:'France vs Espagne 2025 — Live direct Ligue des Nations foot',views:165000,duration:'PT2H',type:'live'},
  {id:'ff_l02',title:'France vs Italie 2025 — Live direct bleus foot',views:128000,duration:'PT2H',type:'live'},
  // ── ATHLÉTISME
  {id:'ath_v01',title:'Mondiaux athlétisme 2025 — Finale 100m hommes résumé',views:685000,duration:'PT15M',type:'video'},
  {id:'ath_v02',title:'Mondiaux athlétisme 2025 — Finale 400m haies résumé',views:312000,duration:'PT14M',type:'video'},
  {id:'ath_v03',title:'Mondiaux athlétisme 2025 — Finale saut en hauteur résumé',views:198000,duration:'PT12M',type:'video'},
  {id:'ath_v04',title:'Mondiaux athlétisme 2025 — Marathon résumé',views:155000,duration:'PT18M',type:'video'},
  {id:'ath_v05',title:'Mondiaux athlétisme 2025 — Bilan médailles France',views:98000,duration:'PT10M',type:'video'},
  {id:'ath_s01',title:'Mondiaux 2025 — Record du monde 200m athlétisme #shorts',views:945000,duration:'PT52S',type:'short'},
  {id:'ath_s02',title:'Mondiaux 2025 — Saut en hauteur record athlé #shorts',views:412000,duration:'PT55S',type:'short'},
  {id:'ath_l01',title:'Mondiaux athlétisme 2025 — Finale 100m Live',views:88000,duration:'PT2H',type:'live'},
  {id:'ath_l02',title:'Mondiaux athlétisme 2025 — Finale marathon Live',views:45000,duration:'PT3H',type:'live'},
  // ── SKI
  {id:'ski_v01',title:'Coupe du monde ski alpin 2025 — Résumé descente Kitzbühel',views:312000,duration:'PT22M',type:'video'},
  {id:'ski_v02',title:'Coupe du monde ski alpin 2025 — Résumé slalom géant',views:245000,duration:'PT20M',type:'video'},
  {id:'ski_v03',title:'Coupe du monde ski alpin 2025 — Résumé slalom',views:198000,duration:'PT18M',type:'video'},
  {id:'ski_v04',title:'Coupe du monde ski alpin 2025 — Bilan saison France',views:112000,duration:'PT15M',type:'video'},
  {id:'ski_s01',title:'Ski alpin 2025 — Chute spectaculaire Kitzbühel #shorts',views:685000,duration:'PT55S',type:'short'},
  {id:'ski_s02',title:'Ski 2025 — Victoire Pinturault géant #shorts',views:298000,duration:'PT52S',type:'short'},
  {id:'ski_l01',title:'Coupe du monde ski 2025 — Descente Kitzbühel Live',views:78000,duration:'PT2H',type:'live'},
  {id:'ski_l02',title:'Coupe du monde ski 2025 — Slalom géant Live',views:62000,duration:'PT2H',type:'live'},
  // ── BIATHLON
  {id:'biat_v01',title:'Biathlon 2025 — Résumé sprint Östersund',views:198000,duration:'PT20M',type:'video'},
  {id:'biat_v02',title:'Biathlon 2025 — Résumé mass start',views:165000,duration:'PT18M',type:'video'},
  {id:'biat_v03',title:'Biathlon 2025 — Quentin Fillon Maillet hat-trick résumé',views:285000,duration:'PT22M',type:'video'},
  {id:'biat_s01',title:'Biathlon 2025 — Tir parfait sous pression #shorts',views:345000,duration:'PT55S',type:'short'},
  {id:'biat_l01',title:'Biathlon 2025 — Mass start Live direct',views:55000,duration:'PT2H',type:'live'},
  {id:'biat_l02',title:'Biathlon 2025 — Sprint final Live',views:48000,duration:'PT1H30M',type:'live'},
  // ── HANDBALL
  {id:'hb_v01',title:'Mondiaux handball 2025 — Finale France résumé',views:1150000,duration:'PT28M',type:'video'},
  {id:'hb_v02',title:'Mondiaux handball 2025 — Demi-finale résumé',views:620000,duration:'PT25M',type:'video'},
  {id:'hb_v03',title:'Mondiaux handball 2025 — Quart de finale résumé',views:385000,duration:'PT22M',type:'video'},
  {id:'hb_v04',title:'Mondiaux handball 2025 — Phase de groupes résumé',views:198000,duration:'PT20M',type:'video'},
  {id:'hb_s01',title:'Mondiaux handball 2025 — But de la finale #shorts',views:512000,duration:'PT55S',type:'short'},
  {id:'hb_s02',title:'Les Experts champions du monde handball 2025 #shorts',views:380000,duration:'PT52S',type:'short'},
  {id:'hb_l01',title:'Mondiaux handball 2025 — Finale Live direct',views:145000,duration:'PT2H',type:'live'},
  {id:'hb_l02',title:'Mondiaux handball 2025 — Demi-finale Live',views:98000,duration:'PT2H',type:'live'},
  // ── VOILE : Vendée Globe
  {id:'vg_v01',title:'Vendée Globe 2025 — Arrivée Charlie Dalin résumé',views:985000,duration:'PT25M',type:'video'},
  {id:'vg_v02',title:'Vendée Globe 2025 — Résumé mi-course',views:312000,duration:'PT18M',type:'video'},
  {id:'vg_v03',title:'Vendée Globe 2025 — Départ Les Sables résumé',views:445000,duration:'PT20M',type:'video'},
  {id:'vg_v04',title:'Vendée Globe 2025 — Les dangers du Cap Horn',views:198000,duration:'PT15M',type:'video'},
  {id:'vg_s01',title:'Vendée Globe 2025 — Arrivée en larmes #shorts',views:680000,duration:'PT58S',type:'short'},
  {id:'vg_s02',title:'Vendée Globe 2025 — Tempête au large #shorts',views:412000,duration:'PT55S',type:'short'},
  {id:'vg_l01',title:'Vendée Globe 2025 — Arrivée Live direct',views:125000,duration:'PT3H',type:'live'},
  // ── NATATION
  {id:'nat_v01',title:'Mondiaux natation 2025 — Léon Marchand 400m 4 nages résumé',views:1250000,duration:'PT18M',type:'video'},
  {id:'nat_v02',title:'Mondiaux natation 2025 — Finale 100m nage libre résumé',views:420000,duration:'PT15M',type:'video'},
  {id:'nat_v03',title:'Mondiaux natation 2025 — Finale relais 4x100 résumé',views:312000,duration:'PT15M',type:'video'},
  {id:'nat_s01',title:'Mondiaux natation 2025 — Marchand record du monde #shorts',views:1480000,duration:'PT52S',type:'short'},
  {id:'nat_s02',title:'Natation 2025 — Virage parfait Marchand #shorts',views:385000,duration:'PT55S',type:'short'},
  {id:'nat_l01',title:'Mondiaux natation 2025 — Finales Live direct',views:88000,duration:'PT3H',type:'live'},
  // ── BASKET
  {id:'bk_v01',title:'EuroBasket 2025 — France en finale résumé',views:485000,duration:'PT22M',type:'video'},
  {id:'bk_v02',title:'EuroBasket 2025 — France vs Espagne résumé',views:312000,duration:'PT20M',type:'video'},
  {id:'bk_v03',title:'NBA 2025 — Wembanyama MVP résumé',views:680000,duration:'PT18M',type:'video'},
  {id:'bk_s01',title:'EuroBasket 2025 — Panier à 3 points clutch #shorts',views:412000,duration:'PT52S',type:'short'},
  {id:'bk_s02',title:'Wembanyama dunk de folie NBA 2025 #shorts',views:890000,duration:'PT55S',type:'short'},
  {id:'bk_l01',title:'EuroBasket 2025 — Finale France Live direct',views:72000,duration:'PT2H30M',type:'live'},
  // ── JUDO
  {id:'ju_v01',title:'Grand Slam Judo Paris 2025 — Finale Teddy Riner résumé',views:385000,duration:'PT18M',type:'video'},
  {id:'ju_v02',title:'Grand Slam Judo Paris 2025 — Résumé journée 1',views:142000,duration:'PT15M',type:'video'},
  {id:'ju_v03',title:'Mondiaux judo 2025 — Bilan France résumé',views:198000,duration:'PT18M',type:'video'},
  {id:'ju_s01',title:'Judo 2025 — Ippon fulgurant Riner #shorts',views:545000,duration:'PT55S',type:'short'},
  {id:'ju_s02',title:'Mondiaux judo 2025 — Médaille d\'or France #shorts',views:285000,duration:'PT52S',type:'short'},
  {id:'ju_l01',title:'Grand Slam Judo Paris 2025 — Finale Live',views:42000,duration:'PT2H',type:'live'},
];
