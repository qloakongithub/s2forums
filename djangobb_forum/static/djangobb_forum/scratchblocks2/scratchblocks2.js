/*
 * scratchblocks2
 * http://github.com/blob8108/scratchblocks2
 *
 * Copyright 2013, Tim Radvan
 * @license MIT
 * http://opensource.org/licenses/MIT
 */

/*
 * The following classes are used:
 *
 * Categories:
 *
 *     sb2
 *     inline-block
 *     script
 *     empty
 *
 * Comments:
 *
 *     comment
 *     attached
 *     to-hat
 *     to-reporter
 *
 * Shapes:
 *
 *     hat                |- Blocks  (These come from the database, the rest
 *     cap                |           come from the parsed code.)
 *
 *     stack              |
 *     embedded           |- Blocks
 *     boolean            |
 *
 *     reporter           |- This one's kinda weird.
 *                           "embedded" and "reporter" should really be the
 *                           same thing, but are separate due to some
 *                           implementation detail that I don't even remember.
 *
 *     string             |
 *     dropdown           |
 *     number             |
 *     number-dropdown    |- Inserts
 *     color              |
 *     define-hat         |
 *     outline            |
 *
 *     cstart |
 *     celse  |- Parser directives. (Used in the database to tell the parser
 *     cend   |                      to create the C blocks.)
 *
 *     cmouth |
 *     cwrap  |- Only used in the CSS code
 *     capend |
 *
 *     ring
 *     ring-inner
 *
 * Categories (colour):
 *
 *     motion
 *     looks
 *     sound
 *     pen
 *     variables
 *     list
 *
 *     events
 *     control
 *     sensing
 *     operators
 *
 *     custom
 *     custom-arg
 *     extension -- Sensor blocks
 *     grey -- for the ". . ." ellipsis block
 *
 *     obsolete
 *
 */

String.prototype.startsWith = function(prefix) {
    return this.indexOf(prefix) === 0;
};

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

String.prototype.contains = function(substring) {
    return this.indexOf(substring) !== -1;
};

String.prototype.trimLeft = function() {
    return this.replace(/^\s+/, "");
}

String.prototype.trimRight = function() {
    return this.replace(/\s+$/, "");
}



var scratchblocks2 = function ($) {
    "use strict";

    function assert(bool) {
        if (!bool) throw "Assertion failed!";
    }

    var sb2 = {}; // The module we export.



    // List of classes we're allowed to override.

    var override_categories = ["motion", "looks", "sound", "pen",
        "variables", "list", "events", "control", "sensing",
        "operators", "custom", "custom-arg", "extension", "grey",
        "obsolete"];
    var override_flags = ["cstart", "celse", "cend", "ring"];
    var override_shapes = ["hat", "cap", "stack", "embedded",
        "boolean", "reporter"];



    /*** Database ***/

    // First, initialise the blocks database.

    /*
     * We need to store info such as category and shape for each block.
     *
     * This can be indexed in two ways:
     *
     *  - by the text input to the parser, minus the insert parts
     *
     *      (eg. "say [Hi!] for (3) secs" is minifed to "sayforsecs", which we
     *           then look up in the database
     *
     *  - by a language code & blockid
     *
     *      (eg. "de" & "say _ for _ secs")
     *
     *      This is used by external add-ons for translating between languages,
     *      and won't get used internally.
     *
     * Some definitions:
     *
     *  - spec: The spec for the block, with underscores representing inserts.
     *          May be translated.
     *          eg. "sage _ für _ Sek."
     *
     *  - blockid: the English spec.
     *          eg. "say _ for _ secs"
     *
     */

    var strings = sb2.strings = {
        aliases: {},

        define: [],
        ignorelt: [],
        math: [],
        osis: [],
    };

    var languages = sb2.languages = {};
    var block_info_by_id = sb2.block_info_by_id = {};
    var block_by_text = {};
    var blockids = []; // Used by load_language

    // Build the English blocks.

    var english = {
        code: "en",

        aliases: {
            "turn left _ degrees": "turn @arrow-ccw _ degrees",
            "turn ccw _ degrees": "turn @arrow-ccw _ degrees",
            "turn right _ degrees": "turn @arrow-cw _ degrees",
            "turn cw _ degrees": "turn @arrow-cw _ degrees",
            "when gf clicked": "when @green-flag clicked",
            "when flag clicked": "when @green-flag clicked",
            "when green flag clicked": "when @green-flag clicked",
        },

        define: ["define"],

        // For ignoring the lt sign in the "when distance < _" block
        ignorelt: ["when distance"],

        // Valid arguments to "of" dropdown, for resolving ambiguous situations
        math: ["abs", "floor", "ceiling", "sqrt", "sin", "cos", "tan", "asin",
               "acos", "atan", "ln", "log", "e ^", "10 ^"],

        // For detecting the "stop" cap / stack block
        osis: ["other scripts in sprite", "other scripts in stage"],

        blocks: [], // These are defined just below
    };

    var english_blocks = [
        ["motion"],

        ["move _ steps", []],
        ["turn @arrow-ccw _ degrees", []],
        ["turn @arrow-cw _ degrees", []],

        ["point in direction _", []],
        ["point towards _", []],

        ["go to x:_ y:_", []],
        ["go to _", []],
        ["glide _ secs to x:_ y:_", []],

        ["change x by _", []],
        ["set x to _", []],
        ["change y by _", []],
        ["set y to _", []],

        ["if on edge, bounce", []],

        ["set rotation style _", []],

        ["x position", []],
        ["y position", []],
        ["direction", []],



        ["looks"],

        ["say _ for _ secs", []],
        ["say _", []],
        ["think _ for _ secs", []],
        ["think _", []],

        ["show", []],
        ["hide", []],

        ["switch costume to _", []],
        ["next costume", []],
        ["switch backdrop to _", []],

        ["change _ effect by _", []],
        ["set _ effect to _", []],
        ["clear graphic effects", []],

        ["change size by _", []],
        ["set size to _%", []],

        ["go to front", []],
        ["go back _ layers", []],

        ["costume #", []],
        ["backdrop name", []],
        ["size", []],

        // Stage-specific

        ["switch backdrop to _ and wait", []],
        ["next backdrop", []],

        ["backdrop #", []],

        // Scratch 1.4

        ["switch to costume _", []],

        ["switch to background _", []],
        ["next background", []],
        ["background #", []],



        ["sound"],

        ["play sound _", []],
        ["play sound _ until done", []],
        ["stop all sounds", []],

        ["play drum _ for _ beats", []],
        ["rest for _ beats", []],

        ["play note _ for _ beats", []],
        ["set instrument to _", []],

        ["change volume by _", []],
        ["set volume to _%", []],
        ["volume", []],

        ["change tempo by _", []],
        ["set tempo to _ bpm", []],
        ["tempo", []],



        ["pen"],

        ["clear", []],

        ["stamp", []],

        ["pen down", []],
        ["pen up", []],

        ["set pen color to _", []],
        ["change pen color by _", []],
        ["set pen color to _", []],

        ["change pen shade by _", []],
        ["set pen shade to _", []],

        ["change pen size by _", []],
        ["set pen size to _", []],



        ["variables"],

        ["set _ to _", []],
        ["change _ by _", []],
        ["show variable _", []],
        ["hide variable _", []],



        ["list"],

        ["add _ to _", []],

        ["delete _ of _", []],
        ["insert _ at _ of _", []],
        ["replace item _ of _ with _", []],

        ["item _ of _", []],
        ["length of _", []],
        ["_ contains _", []],

        ["show list _", []],
        ["hide list _", []],



        ["events"],

        ["when @green-flag clicked", ["hat"]],
        ["when _ key pressed", ["hat"]],
        ["when this sprite clicked", ["hat"]],
        ["when backdrop switches to _", ["hat"]],

        ["when _ > _", ["hat"]],

        ["when I receive _", ["hat"]],
        ["broadcast _", []],
        ["broadcast _ and wait", []],



        ["control"],

        ["wait _ secs", []],

        ["repeat _", ["cstart"]],
        ["forever", ["cstart", "cap"]],
        ["if _ then", ["cstart"]],
        ["else", ["celse"]],
        ["end", ["cend"]],
        ["wait until _", []],
        ["repeat until _", ["cstart"]],

        ["stop _", ["cap"]],

        ["when I start as a clone", ["hat"]],
        ["create clone of _", []],
        ["delete this clone", ["cap"]],

        // Scratch 1.4

        ["if _", ["cstart"]],
        ["forever if _", ["cstart", "cap"]],
        ["stop script", ["cap"]],
        ["stop all", ["cap"]],



        ["sensing"],

        ["touching _?", []],
        ["touching color _?", []],
        ["color _ is touching _?", []],
        ["distance to _", []],

        ["ask _ and wait", []],
        ["answer", []],

        ["key _ pressed?", []],
        ["mouse down?", []],
        ["mouse x", []],
        ["mouse y", []],

        ["loudness", []],

        ["video _ on _", []],
        ["turn video _", []],
        ["set video transparency to _%", []],

        ["timer", []],
        ["reset timer", []],

        ["_ of _", []],

        ["current _", []],
        ["days since 2000", []],
        ["username", []],

        // Scratch 1.4

        ["loud?", []],



        ["operators"],

        ["_ + _", []],
        ["_ - _", []],
        ["_ * _", []],
        ["_ / _", []],

        ["pick random _ to _", []],

        ["_ < _", []],
        ["_ = _", []],
        ["_ > _", []],

        ["_ and _", []],
        ["_ or _", []],
        ["not _", []],

        ["join _ _", []],
        ["letter _ of _", []],
        ["length of _", []],

        ["_ mod _", []],
        ["round _", []],

        ["_ of _", []],



        ["extension"],

        ["when _", ["hat"]],
        ["sensor _?", []],
        ["_ sensor value", []],

        ["turn motor on for _ secs", []],
        ["turn motor on", []],
        ["turn motor off", []],
        ["set motor power _", []],
        ["set motor direction _", []],

        ["when distance < _", ["hat"]],
        ["when tilt = _", ["hat"]],
        ["distance", []],
        ["tilt", []],

        // Scratch 1.4

        ["motor on", []],
        ["motor off", []],
        ["motor on for _ secs", []],
        ["motor power _", []],
        ["motor direction _", []],



        ["grey"],

        ["…", []],
        ["...", []],
    ];

    // The blockids are the same as english block text, so we build the blockid
    // list at the same time.

    var category = null;
    for (var i=0; i<english_blocks.length; i++) {
        if (english_blocks[i].length === 1) { // [category]
            category = english_blocks[i][0];
        } else {                              // [block id, [list of flags]]
            var block_and_flags = english_blocks[i],
                spec = block_and_flags[0], flags = block_and_flags[1];
            english.blocks.push(spec);

            blockids.push(spec); // Other languages will just provide a list of
                                 // translations, which is matched up with this
                                 // list.

            // Now store shape/category info.
            var info = {
                blockid: spec,
                category: category,
            };

            while (flags.length) {
                var flag = flags.pop();
                switch (flag) {
                    case "hat":
                    case "cap":
                        info.shape = flag;
                        break;
                    default:
                        assert(!info.flag);
                        info.flag = flag;
                }
            }

            var image_match = /@([-A-z]+)/.exec(spec);
            if (image_match) {
                info.image_replacement = image_match[1];
            }

            block_info_by_id[spec] = info;
        }
    }

    // Built english, now add it.

    load_language(english);

    function load_language(language) {
        language = clone(language);

        var iso_code = language.code;
        delete language.code;

        // convert blocks list to a dict.
        var block_spec_by_id = {};
        for (var i=0; i<language.blocks.length; i++) {
            var spec = language.blocks[i],
                blockid = blockids[i];
            spec = spec.replace(/@[-A-z]+/, "@"); // remove images
            block_spec_by_id[blockid] = spec;

            // Add block to the text lookup dict.
            var minispec = minify(normalize_spec(spec));
            if (minispec) block_by_text[minispec] = {
                blockid: blockid,
                lang: iso_code,
            };
        }
        language.blocks = block_spec_by_id;

        // add aliases (for images)
        for (var text in language.aliases) {
            strings.aliases[text] = language.aliases[text];

            // Add alias to the text lookup dict.
            var minispec = minify(normalize_spec(text));
            block_by_text[minispec] = {
                blockid: language.aliases[text],
                lang: iso_code,
            };
        }

        // add stuff to strings
        for (var key in strings) {
            if (strings[key].constructor === Array) {
                for (i=0; i<language[key].length; i++) {
                    if (language[key][i]) {
                        strings[key].push(minify(language[key][i]));
                    }
                }
            }
        }

        languages[iso_code] = language;
    }
    sb2.load_language = load_language;

    // Store initial state.
    var _init_strings = clone(strings);
    var _init_languages = clone(languages);
    var _init_block_by_text = clone(block_by_text);

    sb2.reset_languages = function(language) {
        sb2.strings = strings = clone(_init_strings);
        sb2.languages = languages = clone(_init_languages);
        block_by_text = clone(_init_block_by_text);
    }

    // Hacks for certain blocks.

    block_info_by_id["_ of _"].hack = function (info, args) {
        // Operators if math function, otherwise sensing "attribute of" block
        if (!args.length) return;
        var func = minify(strip_brackets(args[0]).replace(/ v$/, ""));
        if (func == "e^") func = "e ^";
        info.category = ($.inArray(func, strings.math) > -1) ? "operators"
                                                             : "sensing";
    }

    block_info_by_id["length of _"].hack = function (info, args) {
        // List block if dropdown, otherwise operators
        if (!args.length) return;
        info.category = (/^\[.* v\]$/.test(args[0])) ? "list"
                                                     : "operators";
    }

    block_info_by_id["stop _"].hack = function (info, args) {
        // Cap block unless argument is "other scripts in sprite"
        if (!args.length) return;
        var what = minify(strip_brackets(args[0]).replace(/ v$/, ""));
        info.shape = ($.inArray(what, strings.osis) > -1) ? null
                                                          : "cap";
    }

    // Define function for getting block info by text.

    function find_block(spec, args) {
        var minitext = minify(spec);
        if (minitext in block_by_text) {
            var lang_and_id = block_by_text[minitext];
            var blockid = lang_and_id.blockid;
            var info = clone(block_info_by_id[blockid]);
            if (info.image_replacement) {
                info.spec = languages[lang_and_id.lang].blocks[blockid];
            } else {
                if (spec === "..." || spec === "…") spec = ". . .";
                info.spec = spec;
            }
            if (info.hack) info.hack(info, args);
            return info;
        }
        if (spec.replace(/ /g, "") === "...") return find_block("...");
    }

    // Utility function that deep clones dictionaries/lists.

    function clone(val) {
        if (val == null) return val;
        if (val.constructor == Array) {
            return val.map(clone);
        } else if (typeof val == "object") {
            var result = {}
            for (var key in val) {
                result[clone(key)] = clone(val[key]);
            }
            return result;
        } else {
            return val;
        }
    }

    // Text minifying functions normalise block text before lookups.

    function remove_diacritics(text) {
        text = text.replace("ß", "ss");
        var map = diacritics_removal_map;
        for (var i = 0; i < map.length; i++) {
            text = text.replace(map[i].letters, map[i].base);
        }
        return text;
    }

    function minify(text) {
        var minitext = text.replace(/[.,%?:▶◀▸◂]/g, "").toLowerCase()
                           .replace(/[ \t]+/g, " ").trim();
        if (window.diacritics_removal_map) {
            minitext = remove_diacritics(minitext);
        }
        if (!minitext && text.replace(" ", "") === "...") minitext = "...";
        return minitext;
    }

    // Insert padding around arguments in spec

    function normalize_spec(spec) {
        return spec.replace(/([^ ])_/g, "$1 _").replace(/_([^ ])/g, "_ $1");
    }

    /*** Parse block ***/

    var BRACKETS = "([<{)]>}";

    // Various bracket-related utilities...

    function is_open_bracket(chr) {
        var bracket_index = BRACKETS.indexOf(chr);
        return (-1 < bracket_index && bracket_index < 4);
    }

    function is_close_bracket(chr) {
        return (3 < BRACKETS.indexOf(chr));
    }

    function get_matching_bracket(chr) {
        return BRACKETS[BRACKETS.indexOf(chr) + 4];
    }

    // Strip one level of brackets from around a piece.

    function strip_brackets(code) {
        if (is_open_bracket(code[0])) {
            var bracket = code[0];
            if (code[code.length - 1] === get_matching_bracket(bracket)) {
                code = code.substr(0, code.length - 1);
            }
            code = code.substr(1);
        }
        return code;
    }

    // Split the block code into text and inserts based on brackets.

    function split_into_pieces(code) {
        var pieces = [],
            piece = "",
            matching_bracket = "",
            nesting = [];

        for (var i=0; i<code.length; i++) {
            var chr = code[i];

            if (nesting.length > 0) {
                piece += chr;
                if (is_open_bracket(chr) && !is_lt_gt(code, i) &&
                        nesting[nesting.length - 1] !== "[") {
                    nesting.push(chr);
                    matching_bracket = get_matching_bracket(chr);
                } else if (chr === matching_bracket && !is_lt_gt(code, i)) {
                    nesting.pop();
                    if (nesting.length === 0) {
                        pieces.push(piece);
                        piece = "";
                    } else {
                        matching_bracket = get_matching_bracket(
                            nesting[nesting.length - 1]
                        );
                    }
                }
            } else {
                if (is_open_bracket(chr) && !is_lt_gt(code, i)) {
                    nesting.push(chr);
                    matching_bracket = get_matching_bracket(chr);

                    if (piece) pieces.push(piece);
                    piece = "";
                }
                piece += chr;
            }
        }
        if (piece) pieces.push(piece); // last piece
        return pieces;
    }

    // A piece is a block if it starts with a bracket.

    function is_block(piece) {
        return piece && is_open_bracket(piece[0]);
    }

    // Function for filtering pieces to get block text & args
    function filter_pieces(pieces) {
        var spec = "";
        var args = [];
        for (var i=0; i<pieces.length; i++) {
            var piece = pieces[i];
            if (is_block(piece) || typeof piece === "object") {
                args.push(piece);
                spec += "_";
            } else {
                spec += piece;
            }
        }
        return {spec: normalize_spec(spec), args: args};
    }

    // Take block code and return block info object.

    function parse_block(code, context, dont_strip_brackets) {
        // strip brackets
        var bracket;
        if (!dont_strip_brackets) {
            bracket = code.charAt(0);
            code = strip_brackets(code);
        }

        // split into text segments and inserts
        var pieces = split_into_pieces(code);

        // define hat?
        for (var i=0; i<strings.define.length; i++) {;;
            var define_text = strings.define[i];
            if (code.toLowerCase() === define_text || (pieces[0] &&
                    pieces[0].toLowerCase().startsWith(define_text+" "))) {
                pieces[0] = pieces[0].slice(define_text.length).trimLeft();

                for (var i=0; i<pieces.length; i++) {
                    var piece = pieces[i];
                    if (is_block(piece)) {
                        piece = {
                            shape: get_custom_arg_shape(piece.charAt(0)),
                            category: "custom-arg",
                            pieces: [strip_brackets(piece).trim()],
                        };
                    }
                    pieces[i] = piece;
                }

                return {
                    shape: "define-hat",
                    category: "custom",
                    pieces: [code.slice(0, define_text.length), {
                        shape: "outline",
                        pieces: pieces,
                    }],
                };
            }
        }

        // get shape
        var shape, isablock;
        if (pieces.length > 1 && bracket !== "[") {
            shape = get_block_shape(bracket);
            isablock = true;
        } else {
            shape = get_insert_shape(bracket, code);
            isablock = $.inArray(shape, ["reporter", "boolean", "stack"]) > -1;
            if (shape.contains("dropdown")) {
                code = code.substr(0, code.length - 2);
            }
        }

        // insert?
        if (!isablock) {
            return {
                shape: shape,
                pieces: [code],
            };
        }

        // trim ends
        if (pieces.length) {
            pieces[0] = pieces[0].trimLeft();
            pieces[pieces.length-1] = pieces[pieces.length-1].trimRight();
        }

        // filter out block text & args
        var filtered = filter_pieces(pieces);
        var spec = filtered.spec;
        var args = filtered.args;

        // override attrs?
        var overrides;
        var match = /^(.*)::([A-z\- ]*)$/.exec(spec);
        if (match) {
            spec = match[1].trimRight();
            overrides = match[2].trim().split(/\s+/);
            while (overrides[overrides.length - 1] === "") overrides.pop();
            if (!overrides.length) overrides = undefined;
        }

        // get category & related block info
        if (spec) var info = find_block(spec, args);

        if (info) {
            if (!info.shape) info.shape = shape;
            if (info.flag === "cend") info.spec = "";
        } else {
            // unknown block
            info = {
                blockid: spec,
                shape: shape,
                category: (shape === "reporter") ? "variables" : "obsolete",
                spec: spec,
                args: args,
            };

            // For recognising list reporters & custom args
            if (info.shape === "reporter") {
                var name = info.spec;
                if (!(name in context.variable_reporters)) {
                    context.variable_reporters[name] = [];
                }
                context.variable_reporters[name].push(info);
            }
        }

        // rebuild pieces (in case text has changed) and parse arguments
        var pieces = [];
        var text_parts = info.spec.split(/([_@▶◀▸◂])/);
        for (var i=0; i<text_parts.length; i++) {
            var part = text_parts[i];
            if (part === "_") {
                var arg = args.shift();
                if (arg === undefined) {
                    part = "_";
                    /* If there are no args left, then the underscore must
                     * really be an underscore and not an insert.
                     *
                     * This only becomes a problem if the code contains
                     * underscores followed by inserts.
                     */
                } else {
                    part = parse_block(arg, context);
                }
            }
            if (part) pieces.push(part);
        }
        delete info.spec;
        delete info.args;
        info.pieces = pieces;

        if (overrides) {
            for (var i=0; i<overrides.length; i++) {
                var value = overrides[i];
                if ($.inArray(value, override_categories) > -1) {
                    info.category = value;
                } else if ($.inArray(value, override_flags) > -1) {
                    info.flag = value;
                } else if ($.inArray(value, override_shapes) > -1) {
                    info.shape = value;
                }
            }

            // Tag ring-inner pieces
            if (info.flag === "ring") {
                for (var i=0; i<info.pieces.length; i++) {
                    var part = info.pieces[i];
                    if (typeof part == "object") {
                        part.is_ringed = true;
                    }
                }
            }
        } else {
            // For recognising list reporters
            var list_block_name = {
                "add _ to _": 1,
                "delete _ of _": 1,
                "insert _ at _ of _": 2,
                "replace item _ of _ with _": 1,
                "item _ of _": 1,
                "length of _": 0,
                "_ contains _": 0,
                "show list _": 0,
                "hide list _": 0,
            };
            if (info.blockid in list_block_name) {
                var index = list_block_name[info.blockid];
                var args = filter_pieces(info.pieces).args;
                var arg = args[index];
                if (arg && arg.shape === "dropdown") {
                    context.lists.push(arg.pieces[0]);
                }
            }
        }

        return info;
    }

    // Return block info object for line, including comment.

    function parse_line(line, context) {
        line = line.trim();

        // comments
        var comment;

        var i = line.indexOf("//");
        if (i !== -1 && line[i-1] !== ":") {
            comment = line.slice(i+2);
            line    = line.slice(0, i).trim();

            // free-floating comment?
            if (!line.trim()) return {blockid: "//", comment: comment,
                                      pieces: []};
        }

        var info;
        if (is_open_bracket(line.charAt(0))
                && split_into_pieces(line).length === 1) {
            // reporter
            info = parse_block(line, context); // don't strip brackets

            if (!info.category) { // cheap test for inserts.
                // Put free-floating inserts in their own stack block.
                info = {blockid: "_", category: "obsolete", shape: "stack",
                        pieces: [info]};
            }
        } else {
            // normal stack block
            info = parse_block(line, context, true);
                                           // true = don't strip brackets
        }

        // category hack (DEPRECATED)
        if (comment && info.shape !== "define-hat") {
            var match = /(^| )category=([a-z]+)($| )/.exec(comment);
            if (match && $.inArray(match[2], override_categories) > -1) {
                info.category = match[2];
                comment = comment.replace(match[0], " ").trim();
            }
        }

        // For recognising custom blocks and their arguments
        if (info.shape === "define-hat") {
            var pieces = info.pieces[1].pieces;
            var filtered = filter_pieces(pieces);
            var minispec = minify(filtered.spec);
            context.define_hats.push(minispec);
            for (var i=0; i<filtered.args.length; i++) {
                context.custom_args.push(filtered.args[i].pieces[0]);
            }
        }
        if (info.shape === "stack" && info.category === "obsolete") {
            var minispec = minify(filter_pieces(info.pieces).spec);
            if (!(minispec in context.obsolete_blocks)) {
                context.obsolete_blocks[minispec] = [];
            }
            context.obsolete_blocks[minispec].push(info);
        }

        if (comment !== undefined && !comment.trim()) comment = undefined;
        info.comment = comment;
        return info;
    }

    // Functions to get shape from code.

    function get_block_shape(bracket) {
        switch (bracket) {
            case "(": return "embedded";
            case "<": return "boolean";
            case "{": default: return "stack";
        }
    }

    function get_insert_shape(bracket, code) {
        switch (bracket) {
            case "(":
                if (/^([0-9e.-]+( v)?)?$/i.test(code)) {
                    if (code.endsWith(" v")) {
                        return "number-dropdown";
                    } else {
                        return "number";
                    }
                } else if (code.endsWith(" v")) {
                    // rounded dropdowns (not actually number)
                    return "number-dropdown";
                } else {
                    // reporter (or embedded! TODO remove this comment)
                    return "reporter";
                }
            case "[":
                if (/^#[a-f0-9]{3}([a-f0-9]{3})?$/i.test(code)) {
                    return "color";
                } else {
                    if (code.endsWith(" v")) {
                        return "dropdown";
                    } else {
                        return "string";
                    }
                }
            case "<":
                return "boolean";
            default:
                return "stack";
        }
    }

    function get_custom_arg_shape(bracket) {
        switch (bracket) {
            case "<": return "boolean";
            default:  return "reporter";
        }
    }

    // Check whether angle brackets are supposed to be lt/gt blocks.

    /*
     * We need a way to parse eg.
     *
     *      if <[6] < [3]> then
     *
     *  Obviously the central "<" should be ignored by split_into_pieces.
     *
     *  In addition, we need to handle blocks containing a lt symbol:
     *
     *      when distance < (30)
     *
     *  We do this by matching against `strings.ignorelt`.
     */

    // Returns true if it's lt/gt, false if it's an open/close bracket.

    function is_lt_gt(code, index) {
        var chr, i;

        if ((code[index] !== "<" && code[index] !== ">") ||
                index === code.length || index === 0) {
            return false;
        }

        // hat block containing lt symbol?
        for (var i=0; i<strings.ignorelt.length; i++) {
            var when_dist = strings.ignorelt[i];
            if (minify(code.substr(0, index)).startsWith(when_dist)) {
                return true; // don't parse as a boolean
            }
        }

        // look for open brackets ahead
        for (i = index + 1; i < code.length; i++) {
            chr = code[i];
            if (is_open_bracket(chr)) {
                break; // might be an innocuous lt/gt!
            }
            if (chr !== " ") {
                return false; // something else => it's a bracket
            }
        }

        // look for close brackets behind
        for (i = index - 1; i > -1; i--) {
            chr = code[i];
            if (is_close_bracket(chr)) {
                break; // must be an innocuous lt/gt!
            }
            if (chr !== " ") {
                return false; // something else => it's a bracket
            }
        }

        // we found a close bracket behind and an open bracket ahead, eg:
        //      ) < [
        return true; // it's an lt/gt block!
    }



    /*** Parse scripts ***/

    // Take scratchblocks text and turn it into useful objects.

    function parse_scripts(code) {
        var context = {obsolete_blocks: {}, define_hats: [], custom_args: [],
                       variable_reporters: {}, lists: []};
        var scripts = [];
        var nesting = [[]];
        var lines = code.trim().split("\n");

        function new_script() {
            if (nesting[0].length) {
                while (nesting.length > 1) {
                    do_cend({blockid: "end", category: "control",
                            flag: "cend", shape: "stack", pieces: []});
                }
                scripts.push(nesting[0]);
                nesting = [[]];
            }
            current_script = nesting[nesting.length - 1];
        }

        function do_cend(info) {
            // pop the innermost script off the stack
            var cmouth = nesting.pop(); // cmouth contents
            if (cmouth.length && cmouth[cmouth.length - 1].shape == "cap") {
                // last block is a cap block
                info.flag += " capend";
            }
            var cwrap = nesting.pop();
            info.category = cwrap[0].category; // category of c block
            cwrap.push(info);
        }

        for (i=0; i<lines.length; i++) {
            var line = lines[i].trim();

            if (!line) {
                if (nesting.length <= 1) new_script();
                continue;
            }

            var current_script = nesting[nesting.length - 1];

            var info = parse_line(lines[i], context);

            if (!info.pieces.length && info.comment !== undefined
                    && nesting.length <= 1) {
                // TODO multi-line comments
                new_script();
                current_script.push(info);
                new_script();
                continue;
            }

            switch (info.flag || info.shape) {
                case "hat":
                case "define-hat":
                    new_script();
                    current_script.push(info);
                    break;

                case "cap":
                    current_script.push(info);
                    if (nesting.length <= 1) new_script();
                    break;

                case "cstart":
                    var cwrap = {
                        type: "cwrap",
                        shape: info.shape,
                        contents: [info],
                    };
                    info.shape = "stack";
                    current_script.push(cwrap);
                    nesting.push(cwrap.contents);
                    var cmouth = {type: "cmouth", contents: [],
                                  category: info.category};
                    cwrap.contents.push(cmouth);
                    nesting.push(cmouth.contents);
                    break;

                case "celse":
                    if (nesting.length <= 1) {
                        current_script.push(info);
                        break;
                    }
                    var cmouth = nesting.pop(); // old cmouth contents
                    if (cmouth.length
                            && cmouth[cmouth.length - 1].shape == "cap") {
                        // last block is a cap block
                        info.flag += " capend";
                    }
                    var cwrap = nesting[nesting.length - 1]; // cwrap contents
                    info.category = cwrap[0].category; // category of c block
                    cwrap.push(info);
                    var cmouth = {type: "cmouth", contents: [],
                                  category: cwrap[0].category};
                    cwrap.push(cmouth);
                    nesting.push(cmouth.contents);
                    break;

                case "cend":
                    if (nesting.length <= 1) {
                        current_script.push(info);
                        break;
                    }
                    do_cend(info);
                    break;

                case "reporter":
                case "boolean":
                case "embedded":
                case "ring":
                    // put free-floating reporters in a new script
                    new_script();
                    current_script.push(info);
                    new_script();
                    break;

                default:
                    current_script.push(info);
            }
        }
        new_script();

        // Recognise custom blocks
        for (var i=0; i<context.define_hats.length; i++) {
            var minispec = context.define_hats[i];
            var custom_blocks = context.obsolete_blocks[minispec];
            if (!custom_blocks) continue;
            for (var j=0; j<custom_blocks.length; j++) {
                custom_blocks[j].category = "custom";
            }
        }

        // Recognise list reporters
        for (var i=0; i<context.lists.length; i++) {
            var name = context.lists[i];
            var list_reporters = context.variable_reporters[name];
            if (!list_reporters) continue;
            for (var j=0; j<list_reporters.length; j++) {
                list_reporters[j].category = "list";
            }
        }

        // Recognise custom args
        for (var i=0; i<context.custom_args.length; i++) {
            var name = context.custom_args[i];
            var custom_args = context.variable_reporters[name];
            if (!custom_args) continue;
            for (var j=0; j<custom_args.length; j++) {
                custom_args[j].category = "custom-arg";
            }
        }

        return scripts;
    }

    sb2.parse_scripts = parse_scripts;



    /*** Render ***/

    /* Render all matching elements in page to shiny scratch blocks.
     * Accepts a CSS-style selector as an argument.
     *
     *  scratchblocks2.parse("pre.blocks");
     *
     * (This should really be called "render_all"...)
     */
    sb2.parse = function (selector, options) {
        selector = selector || "pre.blocks";
        options = options || {
            inline: false,
        }

        // find elements
        $(selector).each(function (i, el) {
            var $el = $(el),
                $container = $('<div>'),
                code,
                scripts,
                html = $el.html();

            html = html.replace(/<br>\s?|\n|\r\n|\r/ig, '\n');
            code = $('<pre>' + html + '</pre>').text();
            if (options.inline) {
                code = code.replace('\n', '');
            }

            var scripts = parse_scripts(code);

            $el.text("");
            $el.append($container);
            $container.addClass("sb2");
            if (options.inline) {
                $container.addClass("inline-block");
            }
            for (var i=0; i<scripts.length; i++) {
                var $script = render_stack(scripts[i]).addClass("script");
                $container.append($script);
            }
        });
    };

    function render_stack(script) {
        var $script = $(document.createElement("div"));
        for (var i=0; i<script.length; i++) {
            var info = script[i];
            $script.append(render_stack_item(info));
            if (info.comment !== undefined) {
                $script.append(render_comment(info));
            }
        }
        return $script;
    }

    function render_stack_item(info) {
        switch (info.type) {
            case "cwrap":
                var $cwrap = render_stack(info.contents).addClass("cwrap")
                                .addClass(info.category);
                if (info.shape === "cap") $cwrap.addClass(info.shape)
                return $cwrap;

            case "cmouth":
                return render_stack(info.contents).addClass("cmouth")
                                .addClass(info.category);

            default:
                return render_block(info);
        }
    }

    function render_comment(info) {
        var $comment = $(document.createElement("div")).addClass("comment")
                .append($(document.createElement("div"))
                .append(document.createTextNode(info.comment.trim() || " ")));
        if (info.shape) {
            $comment.addClass("attached");
            $comment.addClass("to-" + info.shape);
        }
        return $comment;
    }

    function render_block(info) {
        if (!info) return;

        // make DOM element
        var $block = $(document.createElement("div"));
        $block.addClass(info.shape);
        $block.addClass(info.category);
        if (info.flag) $block.addClass(info.flag);

        // color insert?
        if (info.shape === "color") {
            $block.css({"background-color": info.pieces[0]});
            $block.text(" ");
            return $block;
        }

        // ringify?
        var $ring;
        if (info.is_ringed) {
            $ring = $(document.createElement("div")).addClass("ring-inner")
                               .addClass(info.shape).append($block);
        }
        if (info.flag === "ring") {
            $block.addClass("ring");
        }

        // empty?
        if (!info.pieces.length && info.flag !== "cend") {
            $block.addClass("empty");
            return $ring || $block;
        }

        // output text segments & args
        for (var i=0; i<info.pieces.length; i++) {
            var piece = info.pieces[i];
            if (typeof piece === "object") {
                $block.append(render_block(piece));
            } else if (piece === "@" && info.image_replacement) {
                var $image = $("<span>")
                $image.addClass(info.image_replacement);
                $block.append($image);
            } else if (/[▶◀▸◂]/.test(piece)) {
                $block.append(
                    $(document.createElement("span")).addClass("arrow")
                        .append(document.createTextNode(piece)));
            } else {
                if (!piece) piece = " ";
                $block.append(document.createTextNode(piece));
            }
        }

        return $ring || $block;
    }

    return sb2; // export the module
}(jQuery);
// from: http://stackoverflow.com/questions/990904#answer-5912746
diacritics_removal_map = [
    {'base':'A', 'letters':/[\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F]/g},
    {'base':'AA','letters':/[\uA732]/g},
    {'base':'AE','letters':/[\u00C6\u01FC\u01E2]/g},
    {'base':'AO','letters':/[\uA734]/g},
    {'base':'AU','letters':/[\uA736]/g},
    {'base':'AV','letters':/[\uA738\uA73A]/g},
    {'base':'AY','letters':/[\uA73C]/g},
    {'base':'B', 'letters':/[\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181]/g},
    {'base':'C', 'letters':/[\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E]/g},
    {'base':'D', 'letters':/[\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779]/g},
    {'base':'DZ','letters':/[\u01F1\u01C4]/g},
    {'base':'Dz','letters':/[\u01F2\u01C5]/g},
    {'base':'E', 'letters':/[\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E]/g},
    {'base':'F', 'letters':/[\u0046\u24BB\uFF26\u1E1E\u0191\uA77B]/g},
    {'base':'G', 'letters':/[\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E]/g},
    {'base':'H', 'letters':/[\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D]/g},
    {'base':'I', 'letters':/[\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197]/g},
    {'base':'J', 'letters':/[\u004A\u24BF\uFF2A\u0134\u0248]/g},
    {'base':'K', 'letters':/[\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2]/g},
    {'base':'L', 'letters':/[\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780]/g},
    {'base':'LJ','letters':/[\u01C7]/g},
    {'base':'Lj','letters':/[\u01C8]/g},
    {'base':'M', 'letters':/[\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C]/g},
    {'base':'N', 'letters':/[\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4]/g},
    {'base':'NJ','letters':/[\u01CA]/g},
    {'base':'Nj','letters':/[\u01CB]/g},
    {'base':'O', 'letters':/[\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C]/g},
    {'base':'OI','letters':/[\u01A2]/g},
    {'base':'OO','letters':/[\uA74E]/g},
    {'base':'OU','letters':/[\u0222]/g},
    {'base':'P', 'letters':/[\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754]/g},
    {'base':'Q', 'letters':/[\u0051\u24C6\uFF31\uA756\uA758\u024A]/g},
    {'base':'R', 'letters':/[\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782]/g},
    {'base':'S', 'letters':/[\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784]/g},
    {'base':'T', 'letters':/[\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786]/g},
    {'base':'TZ','letters':/[\uA728]/g},
    {'base':'U', 'letters':/[\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244]/g},
    {'base':'V', 'letters':/[\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245]/g},
    {'base':'VY','letters':/[\uA760]/g},
    {'base':'W', 'letters':/[\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72]/g},
    {'base':'X', 'letters':/[\u0058\u24CD\uFF38\u1E8A\u1E8C]/g},
    {'base':'Y', 'letters':/[\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE]/g},
    {'base':'Z', 'letters':/[\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762]/g},
    {'base':'a', 'letters':/[\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250]/g},
    {'base':'aa','letters':/[\uA733]/g},
    {'base':'ae','letters':/[\u00E6\u01FD\u01E3]/g},
    {'base':'ao','letters':/[\uA735]/g},
    {'base':'au','letters':/[\uA737]/g},
    {'base':'av','letters':/[\uA739\uA73B]/g},
    {'base':'ay','letters':/[\uA73D]/g},
    {'base':'b', 'letters':/[\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253]/g},
    {'base':'c', 'letters':/[\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184]/g},
    {'base':'d', 'letters':/[\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A]/g},
    {'base':'dz','letters':/[\u01F3\u01C6]/g},
    {'base':'e', 'letters':/[\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD]/g},
    {'base':'f', 'letters':/[\u0066\u24D5\uFF46\u1E1F\u0192\uA77C]/g},
    {'base':'g', 'letters':/[\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F]/g},
    {'base':'h', 'letters':/[\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265]/g},
    {'base':'hv','letters':/[\u0195]/g},
    {'base':'i', 'letters':/[\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131]/g},
    {'base':'j', 'letters':/[\u006A\u24D9\uFF4A\u0135\u01F0\u0249]/g},
    {'base':'k', 'letters':/[\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3]/g},
    {'base':'l', 'letters':/[\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747]/g},
    {'base':'lj','letters':/[\u01C9]/g},
    {'base':'m', 'letters':/[\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F]/g},
    {'base':'n', 'letters':/[\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5]/g},
    {'base':'nj','letters':/[\u01CC]/g},
    {'base':'o', 'letters':/[\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275]/g},
    {'base':'oi','letters':/[\u01A3]/g},
    {'base':'ou','letters':/[\u0223]/g},
    {'base':'oo','letters':/[\uA74F]/g},
    {'base':'p','letters':/[\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755]/g},
    {'base':'q','letters':/[\u0071\u24E0\uFF51\u024B\uA757\uA759]/g},
    {'base':'r','letters':/[\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783]/g},
    {'base':'s','letters':/[\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B]/g},
    {'base':'t','letters':/[\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787]/g},
    {'base':'tz','letters':/[\uA729]/g},
    {'base':'u','letters':/[\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289]/g},
    {'base':'v','letters':/[\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C]/g},
    {'base':'vy','letters':/[\uA761]/g},
    {'base':'w','letters':/[\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73]/g},
    {'base':'x','letters':/[\u0078\u24E7\uFF58\u1E8B\u1E8D]/g},
    {'base':'y','letters':/[\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF]/g},
    {'base':'z','letters':/[\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763]/g}
];
