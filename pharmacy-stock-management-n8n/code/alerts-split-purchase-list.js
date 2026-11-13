// Turn the purchase list into one item per medicine
const list = $input.first().json.purchaseList || [];
return list.map(p => ({ json: p }));
