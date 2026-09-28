import { decimalInput, PRICE_UNITS, type PriceBasis, type ProductUnit } from './model';
// Exact decimal arithmetic. Return decimal strings; round only at presentation boundaries.
type Decimal={integer:bigint;scale:number};
function parse(value:string):Decimal {
  const [whole,fraction='']=value.split('.');return {integer:BigInt(whole+fraction),scale:fraction.length};
}
function multiply(a:Decimal,b:Decimal):Decimal{return {integer:a.integer*b.integer,scale:a.scale+b.scale};}
function format(value:Decimal):string {
  const digits=value.integer.toString().padStart(value.scale+1,'0');
  if(!value.scale)return digits;
  return (digits.slice(0,-value.scale)+'.'+digits.slice(-value.scale)).replace(/\.?0+$/,'');
}
export type Dimensions={thickness_mm:string|number|null;width_mm:string|number|null;length_mm:string|number|null};
export function theoreticalVolumePerPiece(dimensions:Dimensions):string|null {
  const values=[dimensions.thickness_mm,dimensions.width_mm,dimensions.length_mm].map(value=>decimalInput(value,3,true));
  if(values.some(value=>value===null))return null;
  const result=values.reduce<Decimal>((total,value)=>multiply(total,parse(value!)),{integer:BigInt(1),scale:9});
  return format(result);
}
export function demandVolumeM3(dimensions:Dimensions,quantity:string|null,unit:ProductUnit):string|null {
  const q=decimalInput(quantity);if(q===null)return null;
  if(unit==='CUBIC_METER')return format(parse(q));
  if(unit!=='PIECE')return null;
  const volume=theoreticalVolumePerPiece(dimensions);return volume===null?null:format(multiply(parse(volume),parse(q)));
}
export function expectedRevenue(dimensions:Dimensions,quantity:string|null,unit:ProductUnit,price:string|null,basis:PriceBasis):string|null {
  const q=decimalInput(quantity);const rate=decimalInput(price);if(q===null||rate===null)return null;
  const pricedQuantity=PRICE_UNITS[basis]===unit?q:basis==='PER_M3'?demandVolumeM3(dimensions,q,unit):null;
  return pricedQuantity===null?null:format(multiply(parse(pricedQuantity),parse(rate)));
}
