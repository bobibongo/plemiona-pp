# Przebudowa interfejsu symulatora wioski — projekt

Data: 2026-07-27

Druga runda symulatora, po
`2026-07-26-symulator-budowy-wioski-design.md`. Silnik działa i jest
zweryfikowany względem gry; ta runda zmienia **sposób raportowania wyniku**
i **układ ekranu**.

## Problem

Pierwsza wersja odpowiada na pytanie „kiedy skończę przy tym dochodzie, który
wpisałem" — rozpisując przy każdym kroku, ile stał i na co czekał. W praktyce
to za drobna siatka: realny dochód z farmienia i zbieractwa waha się na tyle,
że przestój policzony co do minuty przy każdym z trzydziestu kroków udaje
precyzję, której nie ma. Efektem jest lista kilkunastu niemal identycznych
ostrzeżeń, w której ginie informacja.

Brakuje natomiast dwóch liczb, które są odporne na tę zmienność:

- **ile ten plan trwa, jeśli nic go nie zatrzymuje** — twarda dolna granica,
  zależna wyłącznie od czasów budowy,
- **ile surowców trzeba dowozić, żeby tej granicy dotrzymać** — jedna liczba
  na surowiec, wprost przekładalna na „ile muszę farmić".

Równolegle ekran wymaga przebudowy: operacje na pliku siedzą w sekcji kolejki,
nie widać stanu wioski jako całości, nie widać, w którym miejscu osi wypadają
dosyłki, a przeciąganie kroków nie daje informacji zwrotnej.

## Zakres

W zakresie:

- czas netto planu i wymagany dochód zewnętrzny, z oznaczeniem wąskiego gardła,
- pasek stanu wioski na całą szerokość, z ikonami i poziomami, odzwierciedlający
  wskazany moment osi,
- górny pasek narzędzi ze światem i operacjami na pliku,
- trzecia kolumna na zaopatrzenie (dochód i dosyłki), z miejscem na rekrutację,
- wtrącenia gracza widoczne w kolejce w miejscu, w którym wypadają,
- czytelne przeciąganie kroków,
- dochód i dosyłki liczone **na dobę**,
- usunięcie oznaczeń niepewności, kolumny czasu w kolejce i powtarzalnych
  ostrzeżeń o przestojach,
- surowce startowe na stałe, bez pola konfiguracji.

Poza zakresem:

- **rekrutacja jednostek** — wymaga równoległych kolejek w Koszarach, Stajni
  i Warsztacie, własnej arytmetyki czasu i konkurencji o populację. To osobna
  runda z własną specyfikacją. Tutaj powstaje wyłącznie miejsce w układzie.
- natywny format szablonu Menedżera Konta,
- automatyczny optymalizator kolejności,
- wiele wiosek naraz.

## Zapotrzebowanie zamiast przestojów

### Czas netto

Suma samych czasów budowy, przy tej samej kolejności kroków, a więc i przy tej
samej progresji poziomu Ratusza co w pełnej symulacji. To dolna granica: nawet
przy nieskończonych surowcach szybciej się nie da.

### Wymagany dochód zewnętrzny

Przebieg pomocniczy ignoruje stan magazynu i przesuwa zegar wyłącznie o czasy
budowy, licząc po drodze własną produkcję kopalń. Dla kroku `k`
rozpoczynającego się w chwili `T(k−1)`:

```
deficyt(k)  = koszt_skumulowany(k) − surowce_startowe − produkcja_wlasna(T(k−1))
wymagany(k) = deficyt(k) / T(k−1)          gdy T(k−1) > 0 i deficyt(k) > 0
wymagany    = maks po wszystkich k
```

Wynik podawany **na dobę**, osobno dla każdego surowca. Krok, na którym wypada
maksimum, to **wąskie gardło planu** — jedyne ostrzeżenie, jakie zostaje z
dawnej listy przestojów.

Miara została sprawdzona na planie 28 kroków od zera: czas netto 4 h 48 min,
wymagany dochód 22 456 drewna, 20 226 gliny i 13 601 żelaza na dobę, wąskie
gardło w kroku 23 (Ratusz na poziom 5, w 1 h 34 min). Profil narasta gładko i
opada, gdy kopalnie nadganiają — maksimum nie jest artefaktem pierwszych sekund.

**Przypadek brzegowy.** Gdy pierwszy krok kosztuje więcej, niż wynoszą surowce
startowe, `T(0)` równa się zeru i iloraz nie istnieje. Taki krok nie wchodzi do
maksimum; zamiast tego plan dostaje osobny komunikat „na pierwszy krok nie
starcza surowców startowych".

### Czas realny

Bez zmian — dotychczasowa symulacja z magazynem, oczekiwaniem, dochodem
i dosyłkami. Zostaje, bo odpowiada na inne pytanie niż czas netto: „kiedy
skończę przy tym, co faktycznie mam". Zmienia się tylko raportowanie: znika
ostrzeżenie wystawiane przy każdym kroku, którego przestój przekroczył próg.

Pozostałe ostrzeżenia zostają bez zmian, bo każde mówi o czymś, czego nie da się
nadrobić dowozem surowców: przepełnienie spichlerza, krok droższy niż jego
pojemność, przekroczona zagroda i niespełnione wymagania. Zostaje też twardy
błąd „przy zerowej produkcji tego kroku nie da się nigdy opłacić" — to nie
przestój, tylko plan niewykonalny.

## Jednostki i format planu

Dochód i dosyłki gracz podaje **na dobę**, bo w takiej skali myśli się
o zbieractwie i farmieniu. Produkcja kopalń pokazywana jest w obu jednostkach —
na godzinę i na dobę — żeby dała się porównać z dochodem.

Pola dochodu w planie zmieniają nazwę z `drewnoH`, `glinaH`, `zelazoH` na
`drewnoD`, `glinaD`, `zelazoD`. **Normalizacja planu przyjmuje oba zapisy** i
przelicza stary na nowy mnożąc przez 24 — inaczej plan zapisany w przeglądarce
w poprzedniej wersji przepadłby przy pierwszym wczytaniu.

Surowce startowe zostają w modelu planu (przydają się w testach i w CLI), ale
znikają z interfejsu i zawsze wynoszą 1000 każdego.

## Układ ekranu

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Plemiona · symulator   [Świat 231 ▾]   Zapisz Wczytaj Tekst JSON Wyczyść     │
├──────────────────────────────────────────────────────────────────────────────┤
│ STAN WIOSKI                        ● na moment: 1 d 04 h 12 min (krok 23)    │
│ ikony budynków z poziomami na ten moment                                     │
│ Czas netto · realny        Populacja zajęta / limit                          │
│ Wydano do tej chwili       Produkcja /h i /dobę                              │
│ Dochód wpisany · wymagany  Dosłano do tej chwili                             │
├───────────────────────┬─────────────────────────┬────────────────────────────┤
│ BUDYNKI               │ KOLEJKA                 │ ZAOPATRZENIE               │
│ ikona, nazwa, poziom  │ numer, ikona, budynek   │ Dochód stały  [+]          │
│ koszt, ludność, [+]   │ → poziom docelowy       │ Dosyłki       [+]          │
│                       │ wtrącenia w miejscu     │ (miejsce na rekrutację)    │
└───────────────────────┴─────────────────────────┴────────────────────────────┘
```

**Górny pasek** przejmuje wybór świata i wszystkie operacje na pliku: zapis,
odczyt, eksport tekstu, import JSON, wyczyszczenie. Znikają z sekcji kolejki.

**Pasek stanu** na całą szerokość, w dwóch częściach. Górna to rząd ikon
budynków z poziomami, wzorowany na „Podsumowaniu" w Menedżerze Konta — z tą
różnicą, że pokazuje wioskę **na wskazany moment**, a nie stan końcowy. Dolna to
liczby wymienione wyżej. Miejsce na wojsko jest w układzie przewidziane, ale do
czasu rekrutacji się nie wyświetla.

**Trzy kolumny** zamiast dwóch. Budynki i kolejka węższe; trzecia mieści
przedziały dochodu i dosyłki, każde z czasem i wartościami, edytowalne
i usuwalne.

## Wybór momentu

Kliknięcie kroku w kolejce zaznacza go i przestawia pasek stanu na chwilę
**zakończenia tego kroku**: poziomy budynków, zajętą ludność, wydane surowce,
produkcję, obowiązujący dochód i sumę dosyłek do tej chwili. Bez zaznaczenia
pasek pokazuje stan końcowy planu.

Wybór jest krokowy, nie ciągły — ziarnistość kroku wystarcza, a unika suwaka,
który przy trzydziestu krokach i tak trafiałby w te same momenty.

Wymaga to, żeby wynik symulacji niósł **poziomy budynków po każdym kroku**.
Dziś niesie zasoby i ludność, ale nie poziomy.

## Kolejka

Znika kolumna czasu — jest w pasku po zaznaczeniu.

Znikają znaki `≈` i nota o udziale poziomów bez pomiaru. Różnice są rzędu
procenta i nie zmieniają decyzji, a znak przy większości wierszy tylko szumi.
Pole `pewny` zostaje w danych; przestaje być tylko pokazywane.

Pojawiają się **wtrącenia w miejscu**: między krokami widać wiersz „po 1 dniu —
dosyłka 5 000 / 5 000 / 5 000" albo „od 2 dni — dochód 2 000 na dobę".
Edytuje się je w trzeciej kolumnie, ale widać je tam, gdzie działają. To
odpowiedź na „nie wiem, w którym miejscu osi je wstawiłem".

**Przeciąganie** dostaje informację zwrotną: ciągnięty kafelek przygasa,
a między kafelkami pojawia się linia wskazująca miejsce wstawienia. Upuszczenie
poniżej ostatniego kafelka dokłada krok na koniec — dziś nie robi nic.

## Podział kodu

`src/wioska/strona.js` urósł do rozmiaru, w którym miesza trzy odpowiedzialności.
Przy tej przebudowie dochodzi czwarta, więc plik dzieli się na:

- `src/wioska/widok-budynki.js` — wiersz tabeli budynków,
- `src/wioska/widok-kolejka.js` — kafelek kroku i wiersz wtrącenia,
- `src/wioska/widok-status.js` — pasek stanu wioski,
- `src/wioska/strona.js` — wyłącznie wpinanie zdarzeń i stan interfejsu.

Funkcje budujące HTML zostają czyste i testowalne bez przeglądarki, tak jak
dotąd. Nowa arytmetyka trafia do osobnego modułu `src/wioska/zapotrzebowanie.js`,
niezależnego od symulacji.

Kolejność w `WIOSKA_LOGIC` w `build.js` musi objąć nowe moduły, z danymi przed
kodem, który z nich korzysta.

## Testy

- **Zapotrzebowanie** — czas netto i wymagany dochód na planie o znanym wyniku;
  osobno przypadek pierwszego kroku droższego niż surowce startowe oraz plan,
  w którym własna produkcja pokrywa wszystko i wymagany dochód wynosi zero.
- **Wąskie gardło** — wskazuje krok o największym zapotrzebowaniu, a nie
  pierwszy albo ostatni.
- **Zgodność jednostek** — plan zapisany w starym formacie `drewnoH` wczytuje
  się i daje ten sam przebieg co jego odpowiednik w `drewnoD`.
- **Poziomy po kroku** — wynik symulacji niesie poziomy odpowiadające stanowi po
  danym kroku.
- **Widoki** — wiersz budynku, kafelek kroku, wiersz wtrącenia i pasek stanu
  budują oczekiwany HTML; pasek stanu dla wskazanego kroku pokazuje wartości
  z tego momentu, nie końcowe.
- **Brak oznaczeń niepewności** — żaden widok ani eksport tekstowy nie zawiera
  znaku `≈`.
- **Ostrzeżenia** — istniejący test `dlugi przestoj daje ostrzezenie` zmienia
  sens: sprawdza teraz, że długi przestój **nie** tworzy już ostrzeżenia przy
  kroku, natomiast plan niewykonalny przy zerowej produkcji nadal je tworzy.
  Testy przepełnienia, pojemności, zagrody i wymagań zostają bez zmian.
- **Samowystarczalność strony** — bez zmian, nadal pilnowana w `test/build.test.js`.

## Otwarte

1. **Rekrutacja** — poza zakresem tej rundy, ale układ ma na nią przewidziane
   miejsce w trzeciej kolumnie i w pasku stanu.
2. **Weryfikacja w przeglądarce** — żaden agent nie ma do niej dostępu, więc
   działanie zaznaczania, przeciągania i schowka potwierdza gracz.
