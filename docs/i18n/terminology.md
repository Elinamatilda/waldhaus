# Global terminology catalogue

Runtime source: `src/lib/i18n/app-ui.ts`. Cash Flow Budget uses the existing global
server-resolved locale, FI/PL/EN, with no feature-local locale state.

| Key | FI | PL | EN |
| --- | --- | --- | --- |
| `nav.cashFlowBudget` | Kassavirtabudjetti | Budżet przepływów pieniężnych | Cash Flow Budget |
| `cashFlow.opening_balance` | Alkusaldo | Saldo początkowe | Opening Balance |
| `cashFlow.sales_revenue` | Myyntitulot | Wpływy ze sprzedaży | Sales Revenue |
| `cashFlow.other_income` | Muut tulot | Pozostałe wpływy | Other Income |
| `cashFlow.total_inflows` | Tulot yhteensä | Wpływy razem | Total Inflows |
| `cashFlow.operating_costs` | Operatiiviset kulut | Koszty operacyjne | Operating Costs |
| `cashFlow.investments` | Investoinnit | Inwestycje | Investments |
| `cashFlow.loan_payments` | Lainanlyhennykset | Spłaty kredytów | Loan Payments |
| `cashFlow.total_outflows` | Menot yhteensä | Wydatki razem | Total Outflows |
| `cashFlow.closing_balance` | Loppusaldo | Saldo końcowe | Closing Balance |

Cash flow sales revenue means cash receipts. Annual Budget sales means budgeted
economic revenue. Cash flow operating costs mean cash paid. These amounts need
not occur in the same month as the economic revenue/expense.

## Liquidity Forecast

| Key | FI | PL | EN |
| --- | --- | --- | --- |
| `nav.liquidityForecast` | Likviditeettiennuste | Prognoza płynności | Liquidity Forecast |
| `liquidity.opening_balance` | Alkusaldo | Saldo początkowe | Opening Balance |
| `liquidity.forecasted_sales` | Ennustettu myynti | Prognozowana sprzedaż | Forecasted Sales |
| `liquidity.other_forecasted_income` | Muut ennustetut tulot | Pozostałe prognozowane wpływy | Other Forecasted Income |
| `liquidity.total_inflows` | Tulot yhteensä | Wpływy razem | Total Inflows |
| `liquidity.total_outflows` | Menot yhteensä | Wydatki razem | Total Outflows |
| `liquidity.net_cash_flow` | Nettokassavirta | Przepływy pieniężne netto | Net Cash Flow |
| `liquidity.closing_balance` | Loppusaldo | Saldo końcowe | Closing Balance |
| `liquidity.minimum_required_balance` | Vaadittu vähimmäiskassa | Minimalne wymagane saldo | Minimum Required Balance |
| `liquidity.sales_needed` | Tarvittava myynti | Wymagana sprzedaż | Sales Needed |

Sales Needed means TOTAL monthly sales required, including any already forecasted
sales. It does not mean additional sales. Each opening balance is independent.

## Product master and commercial data

| Key | FI | PL | EN |
| --- | --- | --- | --- |
| `productMaster.wood_species` | Puulajit | Gatunki drewna | Wood species |
| `productMaster.construction_types` | Rakennetyypit | Typy konstrukcji | Construction types |
| `productMaster.product_variants` | Fyysiset variantit | Warianty fizyczne | Physical variants |
| `productMaster.customer_products` | Asiakastuotteet | Produkty klientów | Customer products |
| `productMaster.customer_product_terms` | Kaupalliset ehdot | Warunki handlowe | Commercial terms |
| `productMaster.demand_unit_code` | Kysynnän yksikkö | Jednostka zapotrzebowania | Demand unit |
| `productMaster.pricing_basis_code` | Hinnoitteluperuste | Podstawa ceny | Pricing basis |
| `productMaster.theoreticalVolume` | Teoreettinen m³ / kpl | Teoretyczne m³ / szt. | Theoretical m³ / piece |

Species is a product classification, not a raw-material inventory item. Construction
type is not a routing/production method. Demand and selling price belong to the
customer relationship terms, not physical variants. Source notes are not translated.
