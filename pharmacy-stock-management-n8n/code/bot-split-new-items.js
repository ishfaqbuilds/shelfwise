return ($input.first().json.appends || []).map(a => ({ json: a }));
