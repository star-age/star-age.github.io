var layout = {
    paper_bgcolor:'rgba(0,0,0,0)',
    plot_bgcolor:'rgba(0,0,0,0)',
    width:  650,
    height: 650,
    xaxis: {
        gridcolor: 'rgba(0.5,0.5,0.5,.5)',
        title: {text: 'BP-RP'},
        linewidth:0,
        range: [-1,3],
        zeroline: false,
        fixedrange: true
    },
    yaxis: {
        gridcolor: 'rgba(0.5,0.5,0.5,.5)',
        title: {text: 'MG'},
        linewidth:0,
        zorder:3,
        range:[10,-5],
        zeroline: false,
        fixedrange: true
    },
    showlegend: false,
    margin:{
            l: 50,
            r: 50,
            b: 50,
            t: 50,
            pad: 0
        }
};

var histogram_layout = {
    paper_bgcolor:'rgba(0,0,0,0)',
    plot_bgcolor:'rgba(0,0,0,0)',
    width:  650,
    height: 250,
    xaxis: {
        gridcolor: 'rgba(235, 232, 221,.25)',
        title: {text: 'Age (Gyr)',font:{color:'#ebe8dd'}},
        linewidth:2,
        color:'#ebe8dd',
        range: [0,14],
        zeroline: false,
        fixedrange: true,
        showticklabels: true
    },
    yaxis: {
        gridcolor: 'rgba(0,0,0,0)',
        title: {text: 'Distribution',font:{color:'#ebe8dd'}},
        linewidth:0,
        color:'#ebe8dd',
        zorder:3,
        zeroline: false,
        fixedrange: true,
        showticklabels: false
    },
    showlegend: true,
    legend: {
        font:{
            color:'#ffffff',
        },
        x: 1,
        xanchor: 'right',
        y: 1,
        itemclick:false
    },
    margin:{
            l: 50,
            r: 50,
            b: 50,
            t: 50,
            pad: 0
        }
};

var config = {
    displayModeBar: false
};

var data = [];
var isochrone_curves = [];
var models_isochrones = {};
var n_traces = 0;
var n_histograms = 0;
var population = [];
var is_population = false;
var n_pop = 0;
var current_moh = 0;

function data_space_to_pixel_space(layout,data_size,direction) {
    if (direction == 'x'){
        var range = layout.xaxis.range[1] - layout.xaxis.range[0];
        var pixels = layout.width;
    }
    else {
        var range = layout.yaxis.range[1] - layout.yaxis.range[0];
        var pixels = layout.height;
    }
    return data_size * pixels / range;
}

function draw_gaussian_point(x, y, std_x, std_y) {
    if (data.length == 0) {
            var gaussian = {
            x: [x],
            y: [y],
            error_x: {
                type: 'data',
                array: [std_x],
                visible: true,
                width: 0
            },
            error_y: {
                type: 'data',
                array: [std_y],
                visible: true,
                width: 0
            },
            mode: 'markers',
            marker: {
                symbol: 'star',
                size: 7,
                color: 'rgba(0,0,0,1)'
            },
            hovertext: '',
            hoverinfo: 'none',
            zorder:2,
            visible: false
        };
        data = [gaussian];
        Plotly.newPlot('hr_diagram', data, layout, config);
    } else {
        data[0].x = [x];
        data[0].y = [y];
        data[0].error_x.array = [std_x];
        data[0].error_y.array = [std_y];
        data[0].visible = true;
        Plotly.redraw('hr_diagram');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    Plotly.newPlot('hr_diagram',data, layout, {displayModeBar: false});
    Plotly.newPlot('age_distribution',[], histogram_layout, {displayModeBar: false});
    update_errors();
    set_controls();
    add_axes();
    var model = document.getElementById("model").value;

    var modelSelect = document.getElementById("model");
    for (var i = 0; i < modelSelect.options.length; i++) {
        var modelName = modelSelect.options[i].value;
        models_isochrones[modelName] = [];
    }

    plot_isochrones(model);
    document.getElementById('hr_diagram').addEventListener('click', function(event) {
        var bb = event.target.getBoundingClientRect();
        var x = document.getElementById('hr_diagram')._fullLayout.xaxis.p2d(event.clientX - bb.left);
        var y = document.getElementById('hr_diagram')._fullLayout.yaxis.p2d(event.clientY - bb.top);
        update_inputs(x,y);
        submit_star();
    });
    document.getElementById("model").addEventListener('change', function() {
        var model = document.getElementById("model").value;
        plot_isochrones(model);
        n_pop = 0;
        submit_star();
    });

    $('#import_div').click(function() {
        import_csv();
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && $('#info').is(':visible')) {
            toggle_help();
        }
    });

    document.getElementById('info_bg').addEventListener('click', function() {
        toggle_help();
    });
});

function zoom_in_out(){
    var ratio = (3-(-1))/(10-(-5));
    if (layout.xaxis.range[1] == 3){
        $('#zoom_div').html('<i class="fa-solid fa-search-minus"></i>Zoom-out');
        if (population.length == 0){
            layout.xaxis.range = [data[0].x[0]-0.25,data[0].x[0]+0.25];
            layout.yaxis.range = [data[0].y[0]+0.2/ratio,data[0].y[0]-0.25/ratio];
        }
        else{
            var center_x = population.reduce((prev, curr) => prev + curr['BP-RP'], 0) / population.length;
            var center_y = population.reduce((prev, curr) => prev + curr['MG'], 0) / population.length;
            var width_x = Math.max.apply(null, population.map(e => e['BP-RP'])) - Math.min.apply(null, population.map(e => e['BP-RP']));
            var width_y = Math.max.apply(null, population.map(e => e['MG'])) - Math.min.apply(null, population.map(e => e['MG']));
            width_x /= 1.75;
            width_y /= 1.75;
            console.log(center_x,center_y,width_x,width_y,width_y/ratio);
            if (width_x > width_y/ratio){
                layout.xaxis.range = [center_x-width_x,center_x+width_x];
                layout.yaxis.range = [center_y+width_x/ratio,center_y-width_x/ratio];
            }
            else{
                layout.xaxis.range = [center_x-width_y*ratio,center_x+width_y*ratio];
                layout.yaxis.range = [center_y+width_y,center_y-width_y];
            }
        }
    }
    else{
        $('#zoom_div').html('<i class="fa-solid fa-search-plus"></i>Zoom-in');
        layout.xaxis.range = [-1,3];
        layout.yaxis.range = [10,-5];
    }
    add_axes();
    Plotly.relayout('hr_diagram', layout);
}

function get_closest_moh(){
    var moh_input = document.getElementById('MoH_input');
    var moh = parseFloat(moh_input.value);
    
    var possible_moh_values = [-2, -1, 0];
    var closest_moh = possible_moh_values.reduce((prev, curr) => 
        Math.abs(curr - moh) < Math.abs(prev - moh) ? curr : prev
    );
    return closest_moh;
}

function toggle_help(){
    $('#info').fadeToggle();
}

function reset_import_button(){
    is_population = false;
    population = [];
    data[0].visible = true;
    n_pop = 0;

    $('#submit').html('<div class="stars"></div>Estimate age<div class="stars"></div>');
    $('#MoH_input').attr('disabled', false);
    $('#MG_input').attr('disabled', false);
    $('#BP_RP_input').attr('disabled', false);
    $('label[for="MoH_input"]').attr('disabled', false);
    $('label[for="MG_input"]').attr('disabled', false);
    $('label[for="BP_RP_input"]').attr('disabled', false);
    $('#eMoH_input').attr('disabled', false);
    $('#eMoH_range').attr('disabled', false);
    $('#eMG_input').attr('disabled', false);
    $('#eMG_range').attr('disabled', false);
    $('#eBP_RP_input').attr('disabled', false);
    $('#eBP_RP_range').attr('disabled', false);
    $('label[for="eMoH_input"]').attr('disabled', false);
    $('label[for="eMoH_range"]').attr('disabled', false);
    $('label[for="eMG_input"]').attr('disabled', false);

    var star_traces_indices = document.getElementById('hr_diagram').data.map((trace, i) => trace.type == 'star' ? i : null).filter(e => e != null);
    Plotly.deleteTraces('hr_diagram', star_traces_indices);
    Plotly.redraw('hr_diagram');
    submit_star();

    $('#import_div').html('<i class="fa-solid fa-file-import"></i>Import csv file');
}

function populate_cmd(stars) {
    is_population = true;
    data[0].visible = false;

    population = stars;
    submit_population();
}

function compute_histogram(ages,normalised='None') {
    var hist = [];
    for (var i = 0; i < 140; i++) {
        var bin_min = i / 10;
        var bin_max = (i + 1) / 10;
        var bin_n = 0;
        for (var j = 0; j < ages.length; j++) {
            var age = ages[j];
            if (!isNaN(age) && age >= bin_min && age < bin_max) {
                bin_n++;
            }
        }
        if (normalised == 'density') {
            hist.push(bin_n/ages.length);
        }
        else {
            hist.push(bin_n);
        }
    }

    if (normalised == 'max') {
        var hist_max = Math.max(...hist);
        for (var i = 0; i < hist.length; i++) {
            hist[i] = hist[i] / hist_max;
        }
    }
    return hist;
}

function get_max_occurence(ages) {
    var hist = [];
    for (var i = 0; i < 140; i++) {
        var bin_min = i / 10;
        var bin_max = (i + 1) / 10;
        var bin_n = 0;
        for (var j = 0; j < ages.length; j++) {
            var age = ages[j];
            if (!isNaN(age) && age >= bin_min && age < bin_max) {
                bin_n++;
            }
        }
        hist.push(bin_n);
    }
    var max_occurence = Math.max(...hist);
    var max_bin = hist.indexOf(max_occurence);
    return [max_bin,max_occurence];
}

async function submit_population() {
    $('body').addClass('waiting');

    var xs = [];
    var ys = [];
    var all_ages = [];
    var has_uncertainties = false;
    if (population[0]['eMG'] != null){
        has_uncertainties = true;
        $('#eMoH_input').attr('disabled', true);
        $('#eMoH_range').attr('disabled', true);
        $('#eMG_input').attr('disabled', true);
        $('#eMG_range').attr('disabled', true);
        $('#eBP_RP_input').attr('disabled', true);
        $('#eBP_RP_range').attr('disabled', true);
        $('label[for="eMoH_input"]').attr('disabled', true);
        $('label[for="eMoH_range"]').attr('disabled', true);
        $('label[for="eMG_input"]').attr('disabled', true);
    }

    mean_moh = 0;
    var stars_non_nan = 0;

    for (var i = 0; i < population.length; i++) {
        var star = population[i];
        var MG = star['MG'];
        var BP_RP = star['BP-RP'];
        var MoH = star['[M/H]'];

        if (isNaN(MoH) == false) {
            mean_moh += MoH;
            stars_non_nan++;
        }

        if (has_uncertainties) {
            var e_MG = star['eMG'];
            var e_BP_RP = star['eBP-RP'];
            var e_MoH = star['e[M/H]'];
        }
        else{
            var e_MG = document.getElementById("eMG_input").value;
            var e_BP_RP = document.getElementById("eBP_RP_input").value;
            var e_MoH = document.getElementById("eMoH_input").value;
        }

        var model_name = document.getElementById("model").value;
        var n = document.getElementById("n_input").value;

        var [ages,_age,_age_std] = await estimate_age(model_name, MG, MoH, BP_RP, e_MG, e_MoH, e_BP_RP, n);
        
        all_ages.push(ages);

        xs.push(BP_RP);
        ys.push(MG);
    }

    mean_moh = mean_moh / stars_non_nan;
    $('#MoH_input').val(mean_moh.toFixed(2));
    if (get_closest_moh(mean_moh) != current_moh){
        var model = document.getElementById("model").value;
        plot_isochrones(model);
    }

    var flat_ages = [];
    var histograms = [];
    for (var i = 0; i < all_ages.length; i++) {
        for (var j = 0; j < all_ages[i].length; j++) {
            if (!isNaN(all_ages[i][j])) {
                flat_ages.push(all_ages[i][j]);
            }
        }
        histograms.push(compute_histogram(all_ages[i],normalised='max'));
    }

    var final_histogram = [];
    for (var i = 0; i < histograms[0].length; i++) {
        var product = (histograms[0][i] + 0.01);
        for (var j = 1; j < histograms.length; j++) {
            if (isNaN(histograms[j])) {
                continue;
            }
            product *= (histograms[j][i] + 0.01);
        }
        final_histogram.push(product);
    }
    var sum = final_histogram.reduce((a,b) => a + b, 0);
    final_histogram = final_histogram.map(e => e / sum);

    plot_age_distribution(flat_ages,final_histogram);
    
    if (n_pop == 0) {
        var points = {
            x: xs,
            y: ys,
            mode: 'markers',
            marker: {
                symbol: 'star',
                size: 7,
                color: 'rgba(0,0,0,1)'
            },
            type: 'star',
            hovertext: '',
            hoverinfo: 'none',
            zorder:2,
            visible: true
        };
        Plotly.addTraces('hr_diagram', points);
        n_pop = xs.length;
    }

    display_age(flat_ages);

    $('body').removeClass('waiting');
}

function import_csv() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = function(event) {
        var file = event.target.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var csv = e.target.result;
                Papa.parse(csv, {
                    header: true,
                    dynamicTyping: true,
                    complete: function(results) {
                        results.data.pop();
                        $('#submit').html('<div class="stars"></div>Estimate ages<div class="stars"></div>');
                        $('#MoH_input').attr('disabled', true);
                        $('#MG_input').attr('disabled', true);
                        $('#BP_RP_input').attr('disabled', true);
                        $('label[for="MoH_input"]').attr('disabled', true);
                        $('label[for="MG_input"]').attr('disabled', true);
                        $('label[for="BP_RP_input"]').attr('disabled', true);
                        var close = $('<i>').addClass('fa-solid fa-xmark');
                        $('#import_div').empty();
                        $('#import_div').append('<i class="fa-solid fa-file"></i>' + file.name);
                        $('#import_div').append(close);
                        close.click(function(ev) {
                            ev.stopPropagation();
                           reset_import_button();
                        });
                        populate_cmd(results.data);
                    }
                });
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function update_inputs(x, y) {
    if (is_population == true) {
        reset_import_button();
        is_population = false;
    }
    document.getElementById("MG_input").value = y.toFixed(2);
    document.getElementById("BP_RP_input").value = x.toFixed(2);
}

function set_controls() {
    var sliders = [
        {range: "eMoH_range", input: "eMoH_input"},
        {range: "eMG_range", input: "eMG_input"},
        {range: "eBP_RP_range", input: "eBP_RP_input"}
    ];

    sliders.forEach(function(slider) {
        var rangeElement = document.getElementById(slider.range);
        var inputElement = document.getElementById(slider.input);
        inputElement.value = rangeElement.value;
        rangeElement.oninput = function() {
            inputElement.value = this.value;
            submit_star();
        }
        inputElement.oninput = function() {
            rangeElement.value = this.value;
            submit_star();
        }
    });

    var ranges = [
        {input: "MoH_input"},
        {input: "MG_input"},
        {input: "BP_RP_input"},
        {input: "n_input"}
    ];

    ranges.forEach(function(r) {
        var inputElement = document.getElementById(r.input);
        inputElement.oninput = function() {
            submit_star();
            if (r.input == 'MoH_input'){
                var model = document.getElementById("model").value;
                plot_isochrones(model);
            }
        }
    });

    document.getElementById("model").onclick = function() {
        if (data[0].visible == true) {
            submit_star();
        }
    }
}

function update_errors() {
    var MG = document.getElementById("MG_input").value;
    var BP_RP = document.getElementById("BP_RP_input").value;

    var eMG = document.getElementById("eMG_input").value;
    var eBP_RP = document.getElementById("eBP_RP_input").value;

    draw_gaussian_point(parseFloat(BP_RP), parseFloat(MG), parseFloat(eBP_RP), parseFloat(eMG));
}

async function submit_star(clicked=false) {
    var MG = document.getElementById("MG_input").value;
    var MoH = document.getElementById("MoH_input").value;
    var BP_RP = document.getElementById("BP_RP_input").value;

    var eMG = document.getElementById("eMG_input").value;
    var eMoH = document.getElementById("eMoH_input").value;
    var eBP_RP = document.getElementById("eBP_RP_input").value;

    var model_name = document.getElementById("model").value;
    var n = document.getElementById("n_input").value;

    if (clicked){
        if (MoH == "") {
            document.getElementById("MoH_input").value = '0.0';
            MoH = 0.0;
        }

        if (n == "") {
            n = 10_000;
            document.getElementById("n_input").value = n;
        }
    }
    else{
        if (isNaN(parseFloat(MG)) || isNaN(parseFloat(MoH)) || isNaN(parseFloat(BP_RP)) || isNaN(parseFloat(eMG)) || isNaN(parseFloat(eMoH)) || isNaN(parseFloat(eBP_RP)) || isNaN(parseInt(n)) ||
        MoH == '' || MG == '' || BP_RP == '' || eMG == '' || eMoH == '' || eBP_RP == '' || n == ''){
            document.getElementById("result").innerHTML = '<span>Error parsing inputs, check possible missing values.</span>';
            return;
        }
    }

    if (is_population == true) {
        submit_population();
        return;
    }

    $('body').addClass('waiting');

    var [ages,age,age_std] = await estimate_age(model_name, MG, MoH, BP_RP, eMG, eMoH, eBP_RP, n);

    $('body').removeClass('waiting');

    display_age(ages);
    data[0].hovertext = age.toFixed(2) + '±' + age_std.toFixed(2) + ' Gyr';
    data[0].hoverinfo = 'text';
    Plotly.redraw('hr_diagram');
    plot_age_distribution(ages);
    update_errors();
}

function display_age(ages){
    ages.sort((a, b) => a - b);
    var mid = Math.floor(ages.length / 2);
    var median = ages.length % 2 !== 0 ? ages[mid] : (ages[mid - 1] + ages[mid]) / 2;
    var mean = ages.reduce((a,b) => a + b, 0) / ages.length;
    var mode = get_max_occurence(ages)[0] / 10;
    var age_std = Math.sqrt(ages.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / ages.length);

    document.getElementById("result").innerHTML = 
    '<span>t<p class="underscore">mean</p> = ' + mean.toFixed(2) +  ' ± ' + age_std.toFixed(2) + ' Gyr</span>' +
    '<span>t<p class="underscore">median</p> = ' + median.toFixed(2) +  ' ± ' + age_std.toFixed(2) + ' Gyr</span>' +
    '<span>t<p class="underscore">mode</p> = ' + mode.toFixed(2) + ' ± ' + age_std.toFixed(2) + ' Gyr</span>';
}

function load_model(model_name) {
    return new Promise((resolve, reject) => {
        $.getJSON('models/NN_' + model_name + '.json', function(data) {
            var weights = data['weights'];
            var biases = data['biases'];
            var means = data['means'];
            var stds = data['stds'];
            resolve([weights, biases, means, stds]);
        }).fail(function() {
            reject("Error loading model");
        });
    });
}

function load_isochrones(model) {
    return new Promise((resolve, reject) => {
        $.getJSON('isochrones/isochrones_' + model + '.json', function(data) {
            resolve(data);
        }).fail(function() {
            reject("Error loading isochrone");
        });
    });
}

function remove_isochrones() {
    var isochrone_traces_indices = document.getElementById('hr_diagram').data.map((trace, i) => trace.type == 'isochrone' ? i : null).filter(e => e != null);
    Plotly.deleteTraces('hr_diagram',isochrone_traces_indices);
}

async function plot_isochrones(model) {
    try {
        remove_isochrones();
        var MG_min = 0;
        var MG_max = 0;
        var BP_RP_min = 0;
        var BP_RP_max = 0;
        var moh = get_closest_moh();
        current_moh = moh;
        if (model in models_isochrones == false) {
            models_isochrones[model] = {};
        }
        if (moh in models_isochrones[model] == false) {
            var isochrones = await load_isochrones(model);
            isochrones = isochrones[moh];
            models_isochrones[model][moh] = isochrones;
        }
        else {
            var isochrones = models_isochrones[model][moh];
        }
        var traces = [];
        n_traces = isochrones.length;
        isochrone_curves = [];
        for (var i = 0; i < isochrones.length; i++) {
            var isochrone = isochrones[i];
            var x = isochrone['BP-RP'];
            var y = isochrone.MG;
            
            /*
            while (x.length > 1000) {
                x = x.filter((e,i) => i % 2 == 0);
                y = y.filter((e,i) => i % 2 == 0);
            }
            */

            //x = x.slice(500, -1);
            //y = y.slice(500, -1);
            
            var x_min = Math.min.apply(null, x);
            var x_max = Math.max.apply(null, x);
            var y_min = Math.min.apply(null, y);
            var y_max = Math.max.apply(null, y);
            if (x_min < BP_RP_min) {
                BP_RP_min = x_min;
            }
            if (x_max > BP_RP_max) {
                BP_RP_max = x_max;
            }
            if (y_min < MG_min) {
                MG_min = y_min;
            }
            if (y_max > MG_max) {
                MG_max = y_max;
            }
            
            var trace = {
                x: x,
                y: y,
                mode: 'lines',
                line: {
                    color: 'rgba(82, 140, 92,.25)',
                    width: 1
                },
                hovertext: isochrone.age.toFixed(2) + ' Gyr',
                hoverinfo: 'text',
                zorder:1,
                type: 'isochrone'
            }
            isochrone_curves.push(trace);
            traces.push(trace);
        }
        layout.xaxis.linewidth = 2;
        Plotly.addTraces('hr_diagram', traces);
        //make_isochrones_hoverable();
    } catch (error) {
        console.log(error);
    }
}

function make_isochrones_hoverable() {
    document.getElementById('hr_diagram').on('plotly_hover', function(data){
        var update = {'line':{color:'rgba(82, 140, 92,1)',width:2}};
        var i_curve = data.points[0].curveNumber;
        Plotly.restyle('hr_diagram', update, [i_curve]);
      });
      
      document.getElementById('hr_diagram').on('plotly_unhover', function(data){
        var update = {'line':{color:'rgba(82, 140, 92,.25)',width:1}};
        var i_curve = data.points[0].curveNumber;
        Plotly.restyle('hr_diagram', update, [i_curve]);
    });
}

function add_axes() {
    var existingAxes = document.getElementById('hr_diagram').data.filter(trace => trace.name == 'axes');
    if (existingAxes.length > 0) {
        var indices = document.getElementById('hr_diagram').data.map((trace, i) => trace.name == 'axes' ? i : null).filter(e => e != null);
        Plotly.deleteTraces('hr_diagram', indices);
    }
    var x_min = layout.xaxis.range[0];
    var x_max = layout.xaxis.range[1];
    var y_min = layout.yaxis.range[0];
    var y_max = layout.yaxis.range[1];
    var x = [x_min,x_max,x_max,x_min,x_min];
    var y = [y_max,y_max,y_min,y_min,y_max];
    var trace = {
        x: x,
        y: y,
        mode: 'lines',
        line: {
            color: 'rgba(0,0,0,0.5)',
            width: 4
        },
        name: 'axes',
        hoverinfo: 'none',
    }
    Plotly.addTraces('hr_diagram', trace);
}

async function estimate_age(model_name, MG, MoH, BP_RP, eMG, eMoH, eBP_RP, n) {
    try {
        var [weights, biases, means, stds] = await load_model(model_name);
        MoH = parseFloat(MoH);
        MG = parseFloat(MG);
        BP_RP = parseFloat(BP_RP);
        var ages = [];
        for (var i = 0; i < n; i++) {
            var a_new = [
                gaussianRandom(MoH, parseFloat(eMoH)),
                gaussianRandom(MG, parseFloat(eMG)),
                gaussianRandom(BP_RP, parseFloat(eBP_RP))
            ]
            age = predict_nn(weights, biases, means, stds, a_new, n);
            ages.push(age[0]);
        }
        var age = 0;
        ages.sort((a, b) => a - b);
        var mid = Math.floor(ages.length / 2);
        age = ages.length % 2 !== 0 ? ages[mid] : (ages[mid - 1] + ages[mid]) / 2;
        age_std = Math.sqrt(ages.reduce((sum, a) => sum + Math.pow(a - age, 2), 0) / ages.length);
        return [ages, age, age_std];
    } catch (error) {
        console.log(error);
    }
    
}

function plot_age_distribution(ages,histogram=null) {
    if (n_histograms > 0) {
        var traces = document.getElementById('age_distribution').data.length;
        Plotly.deleteTraces('age_distribution', Array.from(Array(traces).keys()));
    }
    var trace = {
        x: ages,
        type: 'histogram',
        xbins: {
            size: 0.1,
            start: 0,
            end: 14
        },
        autobinx: false,
        ybins: {
            size: 0.1,
            start: 0,
            end: 14
        },
        autobiny: false,
        marker: {
            color: 'rgba(235, 232, 221,.75)'
        },
        hoverinfo: 'x',
        name: 'Σ H(x)'
    }
    Plotly.addTraces('age_distribution', trace);

    var max_value = get_max_occurence(ages)[1];

    if (histogram != null) {
        var ys = [];
        var hist_max = Math.max(...histogram);
        
        for (var i = 0; i < histogram.length; i++) {
            ys.push(i/10);
            histogram[i] = histogram[i]/hist_max*max_value;
        }

        var min_value = Math.min(...histogram);

        var trace = {
            x: ys,
            y: histogram,
            mode: 'lines',
            line: {
                color: 'rgba(255, 255, 255,1)',
                width: 1
            },
            hoverinfo: 'x',
            name: 'Π G(x)'
        }
        
        Plotly.addTraces('age_distribution', trace);
        Plotly.relayout('age_distribution', {
            showlegend: true,
            'yaxis.range': [min_value, max_value]
        });
    }
    else{
        Plotly.relayout('age_distribution', {
            showlegend: false,
            'yaxis.range': [0, max_value]
        });
    }
    n_histograms = 1;
}

function scale(x, means, stds) {
    return x.map((e,i) => (e - means[i]) / stds[i]);
}

function predict_nn(weights, biases, means, stds, a, n) {
    a = scale(a, means, stds);
    for (var i = 0; i < weights.length; i++) {
        a = dot(a,weights[i]).map((e,j) => e + biases[i][j]);
        a = relu(a);
    }
    return a;
}

function gaussianRandom(mean=0, stdev=1) {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

function relu(x) {
    for (var i = 0; i < x.length; i++) {
        x[i] = Math.max(0, x[i]);
    }
    return x;
}

function dot(x,y) {
    var result = [];
    for (var i = 0; i < y[0].length; i++) {
        var sum = 0;
        for (var j = 0; j < x.length; j++) {
            sum += x[j] * y[j][i];
        }
        result.push(sum);
    }
    return result;
}