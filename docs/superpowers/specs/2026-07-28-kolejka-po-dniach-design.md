# Kolejka podzielona na dni — projekt

Data: 2026-07-28

Piąta runda symulatora budowy wioski, po
`2026-07-28-zapotrzebowanie-dzienne-design.md`.

## Problem

Kolejka pokazuje płaską listę kroków budowy bez żadnego podziału w czasie.
Gracz planujący zaopatrzenie myśli w cyklach dziennych — „w tym dniu ruszam z
dosyłką, potem kilka dni spokoju" — ale dzisiejszy widok nie daje żadnego
punktu odniesienia, w którym dniu który krok się znajduje ani ile dany dzień
kosztuje. Poprzednia runda (`zapotrzebowanieDzienne`) policzyła ten rozkład w
silniku; ten projekt wprowadza go do interfejsu.

## Zakres

W zakresie:

- separator dnia wstawiany w liście kolejki między krokami należącymi do
  różnych dni osi bez przestojów,
- treść separatora: numer dnia, suma surowców tego dnia, liczba kroków,
- pokazanie dni bez żadnego startującego kroku (długi krok obejmujący cały
  następny dzień),
- zgodność z istniejącym wplataniem wtrąceń (dochód/dosyłka) w kolejkę.

Poza zakresem:

- zmiana osi, na której działa pasek stanu czy symulacja — nadal realna oś z
  przestojami tam, gdzie już jest używana,
- realny bilans dzienny z dochodem/dosyłkami/magazynem — kolejna runda,
- możliwość zwijania/rozwijania dni, filtrowania, nawigacji po dniach —
  YAGNI, dopóki gracz nie zgłosi takiej potrzeby.

## Podstawa: oś bez przestojów, nie realna

Separatory dni liczą się na tej samej osi co `zapotrzebowanieDzienne` —
**osi bez przestojów** (`osBezPrzestojow`), nie na realnym przebiegu z
symulacji (`wynik.kroki[i].koniecS`, który zawiera przestoje przy braku
surowców).

To spójne z zasadą, którą gracz opisał wprost: przy budowaniu szablonu
zakłada się, że surowców zawsze starcza i nic nie staje — dni w kolejce mają
pokazywać to idealne tempo, nie efekt konkretnego (jeszcze nieustalonego)
zaopatrzenia. Gdyby dni liczyły się z realnego przebiegu, zmieniałyby się przy
każdej zmianie dochodu czy dosyłki, co jest dokładnie tym mylącym sprzężeniem
zwrotnym, którego runda `2026-07-28-bilans-i-kotwice-krokow` już się pozbyła
dla samych wtrąceń.

## Treść separatora

Jeden wiersz między krokami należącymi do różnych dni:

```
Dzień 3 · 12 000 / 8 000 / 5 000 · 4 kroki
```

Liczby biorą się wprost z odpowiedniego elementu `zapotrzebowanieDzienne(plan)`
— zero dodatkowej arytmetyki w widoku, tylko sformatowanie gotowego wiersza
`{ dzien, drewno, glina, zelazo, liczbaKrokow }`. Numer wyświetlany graczowi
to `dzien + 1` (dni liczone od 1, tak jak kroki są numerowane od 1 w
`krokHTML`).

**Dzień pusty** (`liczbaKrokow === 0`, bo poprzedni krok trwa dłużej niż dobę
i „przykrywa" cały ten dzień) dostaje swój separator normalnie, mimo że nie
ma pod nim żadnego wiersza kroku przed kolejnym separatorem. To zachowuje
ciągłą numerację dni na ekranie — gracz widzi „Dzień 4 · 0 / 0 / 0 · 0 kroków"
i rozumie, że tego dnia nic nowego się nie zaczyna, zamiast dni przeskoczyłyby
z 3 od razu na 5.

## Umiejscowienie względem wtrąceń

Dzisiejsza kolejka wplata wtrącenie (dochód/dosyłka) tuż **przed** krokiem, do
którego wskazuje jego kotwica (`wtracenieHTML(..., przedKrokiem, ...)` w
`kolejkaHTML` w `strona.js`). Ta zasada się nie zmienia.

Separator dnia wstawia się między dwoma kolejnymi krokami, gdy należą do
różnych dni — **niezależnie** od wtrąceń, które być może stoją między nimi.
Kolejność, gdy krok kończący dzień N ma za sobą wtrącenie, a następny krok
zaczyna dzień N+1:

```
...
<krok kończący dzień N>
<wtrącenie, jeśli kotwica wskazuje na ten krok>
Dzień N+1 · ...
<pierwszy krok dnia N+1>
```

Wtrącenie „należy" do kroku, po którym zostało dodane, więc stoi zaraz po nim
— przed separatorem następnego dnia, nie po nim. Ten sam porządek dotyczy
wtrąceń przypiętych do ostatniego kroku całego planu: idą na koniec listy, za
ostatnim separatorem, tak jak dziś idą za ostatnim krokiem.

## Wyznaczanie dnia kroku

`kolejkaHTML` w `strona.js` już ma dostęp do `plan`. Dochodzi:

```js
const os = osBezPrzestojow(plan);
const dzienKroku = os.map(w => Math.floor(w.startS / DOBA_S));
```

`os[i]` odpowiada krokowi `plan.kroki[i]`, który jest tym samym krokiem co
`wynik.kroki[i]` (obie tablice idą w kolejności planu, o czym świadczy
istniejący kod `zapamietajKrokiKotwic`, `poziomyPoKolejce` itd., operujący na
`plan.kroki` i `wynik.kroki` wymiennie po indeksie). Separator wstawia się
przed krokiem `i`, gdy `i === 0` (zawsze pierwszy dzień na starcie) albo
`dzienKroku[i] !== dzienKroku[i - 1]`, a jeśli różnica dni jest większa niż 1
(dzień pusty), wstawiane są kolejne separatory dla każdego pominiętego dnia
aż do `dzienKroku[i]`.

`DOBA_S` istnieje już w `zapotrzebowanie.js`, ale nie jest stamtąd
eksportowane. `strona.js` nie liczy dnia ręcznie z tej stałej — używa gotowej
`zapotrzebowanieDzienne(plan)`, indeksując wiersz danymi z `os` tylko po to,
by wiedzieć, **przy którym kroku** wstawić separator o danym numerze dnia.
Nie duplikuje formuły dzielenia na doby.

## Podział kodu

Nowa funkcja `naglowekDniaHTML(wiersz)` w `widok-kolejka.js`, obok
`krokHTML` i `wtracenieHTML` — przyjmuje jeden element z
`zapotrzebowanieDzienne(plan)` i zwraca gotowy `<li>`. Logika wyznaczania, w
którym miejscu listy wstawić który separator, zostaje w `kolejkaHTML` w
`strona.js`, tak jak już tam mieszka logika wplatania wtrąceń — to jest
warstwa łącząca dane z kilku źródeł (`plan`, `wynik`, teraz
`zapotrzebowanieDzienne`), nie coś do przeniesienia do modułu widoku.

## Testy

- Plan mieszczący się w jednym dniu — jeden separator na starcie listy,
  żadnego więcej.
- Plan rozciągnięty na kilka dni — separator pojawia się dokładnie tam, gdzie
  `dzienKroku` się zmienia, z poprawną treścią (surowce i liczba kroków
  zgodne z `zapotrzebowanieDzienne`).
- Dzień pusty (długi krok obejmujący cały następny dzień) — separator dla
  pustego dnia obecny, bez żadnego kroku między nim a separatorem kolejnego
  dnia.
- Wtrącenie na granicy dni — wtrącenie przypięte do ostatniego kroku dnia N
  renderuje się przed separatorem dnia N+1, nie po nim.
- Plan pusty (brak kroków) — brak separatorów, zachowanie kolejki bez zmian
  względem dzisiejszego.

## Otwarte

Realny bilans dzienny (z dochodem, dosyłkami, pojemnością spichlerza) i
informacja „tu zabraknie surowców, jeśli nic nie zmienisz" — następna runda,
budowana na tym samym rozkładzie dziennym.
