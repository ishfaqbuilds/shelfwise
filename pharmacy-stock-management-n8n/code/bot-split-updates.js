return ($input.first().json.updates || []).map(u => ({ json: u }));
