# Source example arithmetic — review only

Exact Decimal arithmetic from the user-supplied dimensions/annual quantities/prices.
These are validation examples, not seed data or imports. Theoretical rectangular
volume is not actual material consumption, finished-profile net volume or yield.

| Example | mm (T × W × L) | m³ / piece | Annual pieces | Annual m³ | Pricing basis | EUR annual, before rounding |
| --- | --- | --- | --- | --- | --- | --- |
| Tähtiporras / Glueboard | 40 × 650 × 4000 | 0.104 | 300 | 31.200 | 2225 PER_M3 | 69420.000 |
| Pihla / Threshold 130 | 27 × 130 × 3000 | 0.01053 | 1500 | 15.79500 | 10.44 PER_PIECE | 15660.00 |
| Pihla / Threshold 170 | 27 × 170 × 3000 | 0.01377 | 2500 | 34.42500 | 15.39 PER_PIECE | 38475.00 |
| Pihla / Threshold 210 | 27 × 210 × 3000 | 0.01701 | 1000 | 17.01000 | 20.07 PER_PIECE | 20070.00 |
| Parkano / Moulding 2450 | 32 × 46 × 2450 | 0.0036064 | 3000 | 10.8192000 | 2600 PER_M3 | 28129.9200000 |
| Parkano / Moulding 3050 | 32 × 46 × 3050 | 0.0044896 | 3000 | 13.4688000 | 2600 PER_M3 | 35018.8800000 |
| Sawn plank 650 | 27 × 100 × 650 | 0.001755 | 1275 | 2.237625 | 1795 PER_M3 | 4016.536875 |
| Sawn plank 750 | 27 × 100 × 750 | 0.002025 | 5100 | 10.327500 | 1795 PER_M3 | 18537.862500 |
| Sawn plank 850 | 27 × 100 × 850 | 0.002295 | 10200 | 23.409000 | 1795 PER_M3 | 42019.155000 |
| Sawn plank 950 | 27 × 100 × 950 | 0.002565 | 10200 | 26.163000 | 1795 PER_M3 | 46962.585000 |

Tähtiporras: 0.104 m³/piece × 25 = 2.6 m³/month; × 300 = 31.2 m³/year.
The source 65 m³/year differs by 33.8 m³. Do not import it as derived annual volume.
Expected annual revenue at 2225 EUR/m³ is 69,420 EUR; the stated monthly rate is
5,785 EUR at 25 pieces. The exact reason for the source mismatch is unresolved.

Pihla expected annual revenues: 15,660 EUR, 38,475 EUR and 20,070 EUR.
Dividing annual quantities by 12 produces average demand only, not a monthly
schedule. In particular 2500/12 and 1000/12 repeat; rounded 208.33/83.33 must not
be multiplied back to redefine annual demand. No source revenue totals were
provided here, so their numeric differences cannot be calculated yet.

Parkano theoretical volumes: 0.0036064 and 0.0044896 m³/piece; at 250 pieces/month,
0.9016 and 1.1224 m³/month. Annual volumes are 10.8192 and 13.4688 m³.
Every-other-month delivery is a delivery note, not permission to halve annual demand.
The source m³ totals were not supplied, so only expected figures can be reported.

Sawn-plank 20%/40%/40% notes have unresolved meaning and no unambiguous mapping to
all four lengths. Preserve the original source cell/row notes; do not use them as
mix ratios, yield, discounts or wastage. Do not invent the missing customer.
