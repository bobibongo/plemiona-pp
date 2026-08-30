# Symulator rekrutacji jednostek — design

Data: 2026-08-30
Status: zatwierdzony do implementacji

## Cel

Przygotowanie szablonu rekrutacji: ile której jednostki zamówić, ile to
kosztuje, jak długo potrwa i jaką siłę bojową da w efekcie. Tak jak symulator
budowy wioski — narzędzie planistyczne, świadomie teoretyczne. W realnej grze
dochodzi sporo zmiennych (mur, morale, premia nocna, bonusy wioski), których
ten model nie odwzorowuje i nie ma odwzorowywać.

## Zakres

W zakresie:

- poziomy koszar, stajni i warsztatu jako wejście
- koszt surowców i zajęta populacja dla zadanego składu wojska
- czas rekrutacji liczony osobno dla każdego budynku
- bonus rekrutacji w % (osobno koszary / stajnia / warsztat)
- wykres radarowy sumarycznej siły bojowej składu
- wczytywanie i zapisywanie składów jako JSON

Poza zakresem (świadome decyzje):

- prędkość jednostek i ładowność — dla planowania rekrutacji nieistotne
- bonusy bojowe wioski, mur, morale, premia nocna — to symulator rekrutacji,
  nie symulator bitwy
- rycerz i szlachcic — rekrutowane inaczej niż z koszar/stajni/warsztatu
- limit zagrody — symulator podaje samą zajętą populację; ile kto ma wolnego
  miejsca, zależy od rozbudowy jego wioski i każdy ułoży to sobie sam
- symulator bitwy — mechanika walki liczy się po stronie serwera
  (patrz „Symulator bitwy" niżej)

## Dane wejściowe

### Statystyki bojowe

Baza pochodzi z `_share/jednostki.json`, zaciągniętego z API świata
(`pl231.plemiona.pl/interface.php?func=get_unit_info`) — są to wartości
**bez żadnych modyfikatorów**.

Uwaga na przyszłość: podgląd jednostki w grze pokazuje staty **z bonusami
oglądanej wioski**, więc nie zgadza się z tą bazą. Wartości z podglądu wioski
z bonusem obronnym potrafią być wyższe o kilka procent. Do modelu wchodzi
wyłącznie baza z API.

| jednostka | atak | obrona | obr. kaw. | obr. łuk. |
|---|---|---|---|---|
| pikinier | 10 | 15 | 45 | 20 |
| miecznik | 25 | 50 | 15 | 40 |
| topornik | 40 | 10 | 5 | 10 |
| łucznik | 15 | 50 | 40 | 5 |
| zwiadowca | 0 | 2 | 1 | 2 |
| lekka kawaleria | 130 | 30 | 40 | 30 |
| łucznik na koniu | 120 | 40 | 30 | 50 |
| ciężka kawaleria | 150 | 200 | 80 | 180 |
| taran | 2 | 20 | 50 | 20 |
| katapulta | 100 | 100 | 50 | 100 |

Świat 231 ma badania binarne (zbadane / niezbadane), bez poziomów ulepszeń.
Model nie przewiduje mnożników ulepszeń.

### Koszty, populacja, czas

Bez zmian — bierzemy z istniejących modułów:

- `src/wioska/swiaty.js` — koszt, populacja, bazowy czas rekrutacji
- `src/wioska/jednostki.js` — `kosztJednostki`, `populacjaJednostki`,
  `czasRekrutacji`, `budynekJednostki`

Nie duplikujemy tych wzorów.

## Architektura

Osobna strona, wspólne moduły. Nowy katalog `src/jednostki/`, nowy cel
`dist/jednostki/index.html`. Logika importuje istniejące moduły z
`src/wioska/` — poprawka wzoru w jednym miejscu działa w obu symulatorach.

```
src/jednostki/
  staty.js       — staty bojowe + suma siły składu
  koszty.js      — koszt surowców i zajęta populacja
  czas.js        — czas rekrutacji per budynek, z bonusem %
  radar.js       — geometria wielokąta (czysta, bez DOM)
  szablon.js     — walidacja i normalizacja JSON składu
  strona.js      — UI, jedyny moduł dotykający DOM
```

Podział taki, żeby każdy moduł dało się przetestować bez przeglądarki —
`strona.js` jest jedynym, który zna DOM.

## Model obliczeń

### Koszt i populacja

Suma po jednostkach: `ilosc * kosztJednostki(...)` dla każdego surowca,
analogicznie populacja. Populacja jest wyłącznie informacją — bez limitu i bez
ostrzeżeń. Rozbudowana wioska ma ok. 24 000 miejsca, z czego ok. 4 000 zjadają
budynki, ale to zależy od wioski i użytkownik zestawi to sam.

### Czas rekrutacji

Koszary, stajnia i warsztat produkują **równolegle**. Dlatego:

- czas budynku = suma czasów jego jednostek (jedna kolejka, sekwencyjnie)
- czas całości = **maksimum** z trzech budynków, nie suma

To najważniejsza decyzja modelu. Suma dałaby wynik zawyżony nawet
kilkukrotnie.

Czas jednostki liczy `czasRekrutacji(s, jednostka, poziomBudynku)` —
istniejący wzór `czas / (1 + poziom * 0.05) / predkoscJednostek`.

### Bonus rekrutacji

Osobny procent dla koszar, stajni i warsztatu. Odwzorowuje premie
przyspieszające rekrutację. Bonus skraca czas:

```
czasZBonusem = czasBazowy / (1 + bonusProcent / 100)
```

Bonus 0% nie zmienia nic. Wartości ujemne odrzucamy przy walidacji.

### Siła bojowa

Dla każdej z czterech osi: `suma(ilosc * statJednostki)`. Radar pokazuje
sumaryczną siłę składu, nie średnią — 7000 pikinierów ma dawać większy
wielokąt niż 700.

Osie: atak, obrona ogólna, obrona przeciw kawalerii, obrona przeciw łucznikom.

Skalowanie: każda oś normalizowana do własnego maksimum w porównywanych
składach, żeby oś ataku (setki tysięcy) nie spłaszczyła pozostałych.

## Format szablonu

Wzorowany na `szablony/*.json` dla wioski — plain JSON wklejany w modalu.

```json
{
  "swiat": "pl231",
  "nazwa": "def pik+luk",
  "poziomy": {
    "koszary": 25,
    "stajnia": 20,
    "warsztat": 15
  },
  "bonusRekrutacji": {
    "koszary": 0,
    "stajnia": 0,
    "warsztat": 0
  },
  "sklad": {
    "pikinier": 7000,
    "lucznik": 7000
  }
}
```

Walidacja: nieznana jednostka lub świat to błąd z czytelnym komunikatem;
brakujące pola dostają wartości domyślne (poziomy 1, bonusy 0, skład pusty).

## Testy

TDD, zgodnie z konwencją repo. `test/jednostki-*.test.js`, `node --test`.

Przypadki, na których zależy najbardziej:

- czas całości to maksimum z budynków, nie suma (sedno modelu)
- skład tylko z koszar nie generuje czasu stajni ani warsztatu
- bonus 0% nie zmienia czasu; bonus 100% połowi go
- pusty skład daje zera, nie dzielenie przez zero ani NaN
- suma siły jest liniowa: 2× skład = 2× każda oś
- normalizacja radaru odporna na oś zerową (sam zwiadowca → atak 0)
- szablon z nieznaną jednostką odrzucony z komunikatem

## Ryzyka

- **Model teoretyczny.** Nie uwzględnia przestojów, braku surowców w trakcie
  ani kolejkowania Menedżera. Do planowania szablonu wystarcza; jako prognoza
  „za ile dokładnie będę mieć wojsko" — nie.
- **Staty bez modyfikatorów.** Radar porównuje składy między sobą. Nie jest
  prognozą wyniku bitwy i nie powinien być tak czytany.
- **Bonus rekrutacji jako prosty dzielnik.** Jeśli w grze premie składają się
  inaczej (np. multiplikatywnie z innymi efektami), wzór trzeba będzie
  skorygować — dlatego siedzi w jednym miejscu, w `czas.js`.

## Symulator bitwy — zbadane, poza zakresem

Sprawdzone na `_share/HTML/symulator.html` i `symulator_files/Simulator.802fe5.js_`.

Mechaniki **nie da się przejąć z gry**: formularz robi POST na
`game.php?screen=place&mode=sim`, a cała walka liczy się po stronie serwera.
Kod klienta (13 KB) to wyłącznie UI — nie zawiera żadnego wzoru bojowego
(brak `Math.pow`, `Math.sqrt`, obliczeń obrażeń); jedyne wywołania ajax to
`calculate_morale` i zarządzanie szablonami efektów.

Pomysł na później (lepszy niż przepisywanie wzorów): skrypt wypełniający
formularz symulatora w grze składem wygenerowanym tutaj — z mnożnikiem
(np. 4 nasze zagrody vs 4× off przeciwnika) i gotowymi standardami. Liczy
wtedy serwer, więc wynik jest z definicji zgodny z grą, a my dostarczamy samo
wypełnianie pól. Zgodne z zasadą repo: skrypt wypełnia, człowiek zatwierdza.

Alternatywa gorsza: zaimplementować publicznie udokumentowane wzory TW
(przewaga liczebna^1,5, mur, morale, szczęście ±25%, premia nocna, podział
obrony wg typów atakującego) od zera. To osobny projekt z własnym specem —
świadomie poza zakresem tego symulatora. Główne ryzyko: bez możliwości
weryfikacji wyniku przeciwko serwerowi łatwo zbudować narzędzie, które wygląda
wiarygodnie i podaje złe liczby.
