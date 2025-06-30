var layout = {
    paper_bgcolor:'rgba(0,0,0,0)',
    plot_bgcolor:'rgba(0,0,0,0)',
    width:  650,
    height: 650,
    xaxis: {
        gridcolor: 'rgba(0.5,0.5,0.5,.5)',
        title: {text: '(BP-RP)'},
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
        range: [0,1],
        zeroline: false,
        fixedrange: true,
        showticklabels: false
    },
    barmode: 'overlay',
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
var csv_data = null;
var invisible_histogram = null;
var zoomed_in = false;

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
                width: 0,
                color: 'rgba(0,0,0,1)'
            },
            error_y: {
                type: 'data',
                array: [std_y],
                visible: true,
                width: 0,
                color: 'rgba(0,0,0,1)'
            },
            mode: 'markers',
            type:'star',
            marker: {
                symbol: 'star',
                size: 7,
                color: 'rgba(0,0,0,1)'
            },
            hovertext: '',
            hoverinfo: 'skip',
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

    var fake_ages = [];
    for (var i = 0; i < 140; i++) {
        fake_ages.push(i/10);
    }
    invisible_histogram = {
        x: fake_ages,
        type: 'histogram',
        xbins: {
            size: 0.1,
            start: 0,
            end: 14
        },
        autobinx: false,
        marker: {
            color: 'rgba(0,0,0,0)' // Fully transparent
        },
        hoverinfo: 'x', // Enable hover for this trace
        name: 'Hover Helper',
        showlegend: false // Hide from legend
    };
    Plotly.addTraces('age_distribution', invisible_histogram);

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
        submit_star(clicked=true);
    });
    document.getElementById("model").addEventListener('change', function() {
        var model = document.getElementById("model").value;
        plot_isochrones(model);
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

    document.getElementById('age_distribution').on('plotly_hover', function(data) {
        if (data.points[0].data.name === 'Hover Helper') { // Link hover to the invisible histogram
            var age_bin = data.points[0].x;
            highlight_stars(age_bin);
        }
    });

    document.getElementById('age_distribution').on('plotly_unhover', function(data) {
        unhighlight_stars();
    });

    document.getElementById('age_distribution').on('plotly_click', function(data){
        select_hist(data,1);
    });
});

function select_hist(data,opacity){
    var selected_x = data.points[0].x;
    var selected_y = data.points[0].y;
    if (data.points[0].data.type === 'histogram') {
        var selection_hist = document.getElementById('age_distribution').data.filter(trace => trace.type == 'select_bin');
        $('#deselect_bin').show();
        if (selection_hist.length > 0) {
            selection_hist[0].visible = true;
            selection_hist[0].x = [selected_x - 0.05, selected_x + 0.05, selected_x + 0.05, selected_x - 0.05, selected_x - 0.05];
            selection_hist[0].y = [0, 0, selected_y, selected_y, 0];
        }
        else{
            var selection = {
                x: [selected_x - 0.05, selected_x + 0.05, selected_x + 0.05, selected_x - 0.05, selected_x - 0.05],
                y: [0, 0, selected_y, selected_y, 0],
                fill: 'toself',
                fillcolor: 'rgba(255,255,255,'+opacity+')',
                line: {
                    color: 'rgba(0,0,0,1)',
                    width: 0
                },
                mode:'none',
                visible: true,
                type: 'select_bin',
                hoverinfo: 'skip',
                showlegend: false,
            };
            Plotly.addTraces('age_distribution', selection);
        }
        Plotly.redraw('age_distribution');
    }
}

function deselect_bin() {
    var selection_hist = document.getElementById('age_distribution').data.filter(trace => trace.type == 'select_bin');
    if (selection_hist.length > 0) {
        selection_hist[0].visible = false;
        Plotly.redraw('age_distribution');
        unhighlight_stars();
        $('#deselect_bin').hide();
    }
}

function unhighlight_stars() {
    var selection_hist = document.getElementById('age_distribution').data.filter(trace => trace.type == 'select_bin');
    if (selection_hist.length == 0 || selection_hist[0].visible == false) {
        var stars = document.getElementById('hr_diagram').data.filter(trace => trace.type == 'star' && trace.visible == true);
        if (stars.length > 0) { 
            stars = stars[0];
            stars.marker.color = Array(stars.x.length).fill('rgba(0,0,0,1)');
            if (stars.error_x != null){
                stars.error_x.color = 'rgba(0,0,0,1)';
                stars.error_y.color = 'rgba(0,0,0,1)';
            }
        }

        var isochrones = document.getElementById('hr_diagram').data.filter(trace => trace.type == 'isochrone');
        if (isochrones.length > 0) {
            for (var i = 0; i < isochrones.length; i++) {
                isochrones[i].line.color = 'rgba(82, 140, 92,.25)';
                isochrones[i].line.width = 1;
            }
        }

        Plotly.redraw('hr_diagram');
    }
    else{
        var age_bin = selection_hist[0].x[0] + 0.05;
        highlight_stars(age_bin);
    }
}

function highlight_stars(age_bin) {
    var bins = document.getElementById('age_distribution').data.filter(trace => trace.type == 'histogram')[0];
    var colors = [];
    var bin_colors = [];
    
    for (var i = 0; i < bins.x.length; i++) {
        var bin = bins.x[i];
        if (age_bin == bin) {
            bin_colors.push('rgba(235, 232, 221,1)');
        }
        else {
            bin_colors.push('rgba(235, 232, 221,.75)');
        }
    }

    var stars = document.getElementById('hr_diagram').data.filter(trace => trace.type == 'star' && trace.visible == true);
    if (stars.length > 0){
        stars = stars[0];
        for (var i = 0; i < stars.x.length; i++) {
            if (stars.x.length == 1){
                var hovertext = stars.hovertext;
            }
            else{
                var hovertext = stars.hovertext[i];
            }
            var age = parseFloat(hovertext.split('±')[0]);
            var opacity = 0.05;
            var age_dif = Math.abs(age - age_bin);
            if (age_dif < 0.1){
                opacity = 1;
            }
            else if (age_dif < 1){
                opacity = .95 - age_dif + 0.05;
            }
            colors.push('rgba(0,0,0,' + opacity + ')');
        }
        stars.marker.color = colors;
        if (stars.error_x != null){
            if (stars.error_x.array.length == 1){
                stars.error_x.color = colors[0];
                stars.error_y.color = colors[0];
            }
            else{
                stars.error_x.color = colors;
                stars.error_y.color = colors;
            }
        }
    }

    // Highlight the closest isochrone curve
    var isochrones = document.getElementById('hr_diagram').data.filter(trace => trace.type == 'isochrone');
    if (isochrones.length > 0) {
        var closest_curve_index = -1;
        var closest_age_diff = Infinity;

        for (var i = 0; i < isochrones.length; i++) {
            var isochrone_age = parseFloat(isochrones[i].hovertext.split(' ')[0]); // Extract age from hovertext
            var age_diff = Math.abs(isochrone_age - (age_bin-0.05));
            if (age_diff < closest_age_diff) {
                closest_age_diff = age_diff;
                closest_curve_index = i;
            }
        }

        if (closest_curve_index !== -1) {
            // Reset all isochrone styles
            for (var i = 0; i < isochrones.length; i++) {
                isochrones[i].line.color = 'rgba(82, 140, 92,.25)';
                isochrones[i].line.width = 1;
            }

            // Highlight the closest isochrone
            isochrones[closest_curve_index].line.color = 'rgba(82, 140, 92,1)';
            isochrones[closest_curve_index].line.width = 2;
        }
    }

    Plotly.redraw('hr_diagram');
}

function zoom_in_out(){
    var ratio = (3-(-1))/(10-(-5));
    if (zoomed_in == false){
        zoomed_in = true
        $('#zoom_div').html('<i class="fa-solid fa-search-minus"></i>Zoom-out');
        if (population.length == 0){
            layout.xaxis.range = [data[0].x[0]-0.25,data[0].x[0]+0.25];
            layout.yaxis.range = [data[0].y[0]+0.2/ratio,data[0].y[0]-0.25/ratio];
        }
        else{
            var min_x = Math.min.apply(null, population.map(e => e['BP-RP']));
            var max_x = Math.max.apply(null, population.map(e => e['BP-RP']));
            var min_y = Math.min.apply(null, population.map(e => e['MG']));
            var max_y = Math.max.apply(null, population.map(e => e['MG']));
            var margin_x = .05;
            var margin_y = .1;
            layout.xaxis.range = [min_x - margin_x,max_x + margin_x];
            layout.yaxis.range = [max_y + margin_y,min_y - margin_y];
        }
    }
    else{
        zoomed_in = false
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
    if (isNaN(moh)){
        moh = 0;
    }
    
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
    $('label[for="eBP_RP_input"]').attr('disabled', false);
    $('label[for="eMG_input"]').attr('disabled', false);

    var star_traces_indices = document.getElementById('hr_diagram').data.map((trace, i) => (trace.type == 'star' && trace.visible == true) ? i : null).filter(e => e != null);
    Plotly.deleteTraces('hr_diagram', star_traces_indices);
    data[0].visible = true;
    $('#deselect_bin').hide();
    Plotly.redraw('hr_diagram');
    submit_star();

    $('#import_div').html('<i class="fa-solid fa-file-import"></i>Import csv file');
    $('#import_div').attr('file_loaded',false);
    $('#export_div').remove();
}

function populate_cmd(stars) {
    is_population = true;
    data[0].visible = false;

    population = stars;
    submit_star();
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
    $('#loading_div').css('top','0px');
    $('#loading_bar').css('width','0%');

    var xs = [];
    var ys = [];
    var all_ages = [];
    var has_uncertainties = false;
    if (population[0]['e(MG)'] != null){
        has_uncertainties = true;
        $('#eMoH_input').attr('disabled', true);
        $('#eMoH_range').attr('disabled', true);
        $('#eMG_input').attr('disabled', true);
        $('#eMG_range').attr('disabled', true);
        $('#eBP_RP_input').attr('disabled', true);
        $('#eBP_RP_range').attr('disabled', true);
        $('label[for="eMoH_input"]').attr('disabled', true);
        $('label[for="eMoH_range"]').attr('disabled', true);
        $('label[for="eBP_RP_input"]').attr('disabled', true);
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
            var e_MG = star['e(MG)'];
            var e_BP_RP = star['e(BP-RP)'];
            var e_MoH = star['e([M/H])'];
        }
        else{
            var e_MG = document.getElementById("eMG_input").value;
            var e_BP_RP = document.getElementById("eBP_RP_input").value;
            var e_MoH = document.getElementById("eMoH_input").value;
        }

        var model_name = document.getElementById("model").value;
        var n = document.getElementById("n_input").value;

        var [ages,_median_age,_mean_age,_mode_age,_age_std] = await estimate_age(model_name, MG, MoH, BP_RP, e_MG, e_MoH, e_BP_RP, n);

        population[i]['age_median'] = _median_age;
        population[i]['age_mean'] = _mean_age;
        population[i]['age_mode'] = _mode_age;
        population[i]['age_std'] = _age_std;
        
        all_ages.push(ages);

        xs.push(BP_RP);
        ys.push(MG);
        $('#loading_div').html('Computing age of star ' + (i+1) + '/' + population.length + '... (' + Math.round((i+1)/population.length*100) + '%)');
        $('#loading_bar').css('width',Math.round((i+1)/population.length*100) + '%');
    }

    csv_data = population;

    mean_moh = mean_moh / stars_non_nan;
    $('#MoH_input').val(mean_moh.toFixed(2));
    if (get_closest_moh(mean_moh) != current_moh){
        var model = document.getElementById("model").value;
        plot_isochrones(model);
    }

    var hover_texts = [];
    var colors = [];

    var flat_ages = [];
    var histograms = [];
    for (var i = 0; i < all_ages.length; i++) {
        var median_age = all_ages[i].sort((a, b) => a - b)[Math.floor(all_ages[i].length / 2)];
        var std_age = Math.sqrt(all_ages[i].reduce((sum, a) => sum + Math.pow(a - median_age, 2), 0) / all_ages[i].length);
        var hover_text = median_age.toFixed(2) + '±' + std_age.toFixed(2) + ' Gyr';
        hover_texts.push(hover_text);
        colors.push('rgba(0,0,0,1)');

        for (var j = 0; j < all_ages[i].length; j++) {
            if (!isNaN(all_ages[i][j])) {
                flat_ages.push(all_ages[i][j]);
            }
        }
        histograms.push(compute_histogram(all_ages[i],normalised='max'));
    }

    if (false){
        var final_histogram = [];
        for (var i = 0; i < histograms[0].length; i++) {
            var product = (histograms[0][i] + 0.01);
            for (var j = 1; j < histograms.length; j++) {
                if (isNaN(histograms[j][i])) {
                    continue;
                }
                product *= (histograms[j][i] + 0.01);
            }
            final_histogram.push(product);
        }
        var sum = final_histogram.reduce((a,b) => a + b, 0);
        final_histogram = final_histogram.map(e => e / sum);

        plot_age_distribution(flat_ages,final_histogram);
    }
    else{
        plot_age_distribution(flat_ages,null);
    }
    
    if (n_pop == 0) {
        var points = {
            x: xs,
            y: ys,
            mode: 'markers',
            marker: {
                symbol: 'star',
                size: 7,
                color: colors
            },
            type: 'star',
            hovertext: hover_texts,
            hoverinfo: 'skip',
            zorder:2,
            visible: true
        };
        Plotly.addTraces('hr_diagram', points);
        n_pop = xs.length;
    }
    else{
        var points = document.getElementById('hr_diagram').data.filter(trace => trace.type == 'star' && trace.visible == true);
        points[0].x = xs;
        points[0].y = ys;
        points[0].marker.color = colors;
        points[0].hovertext = hover_texts;
        points[0].visible = true;
    }
    display_age(flat_ages,final_histogram);
    if (zoomed_in){
        zoom_in_out();
        zoom_in_out();
    }

    $('body').removeClass('waiting');
    $('#loading_div').css('top','-100px');
    $('#loading_bar').css('width','0%');
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
                        $('#import_div').attr('file_loaded',true);
                        $('#import_div').append(close);
                        $('#import_div').after('<div class="header_button" id="export_div" onclick="export_csv()"><i class="fa-solid fa-file-export"></i>Export csv file</div>');
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

function export_csv() {
    var csv = Papa.unparse(csv_data);
    var blob = new Blob([csv], {type: 'text/csv'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = $('#import_div').text().replace(/\s/g, '_').replace('.csv', '_ages.csv');
    a.click();
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


    if (is_population == true) {
        submit_population();
        return;
    }

    if (clicked){
        if (MoH == "") {
            document.getElementById("MoH_input").value = '0.0';
            MoH = 0.0;
        }

        if (n == "" || parseFloat(n) == 0) {
            n = 10_000;
            document.getElementById("n_input").value = n;
        }
    }
    else{
        if (isNaN(parseFloat(MG)) || isNaN(parseFloat(MoH)) || isNaN(parseFloat(BP_RP)) || isNaN(parseFloat(eMG)) || isNaN(parseFloat(eMoH)) || isNaN(parseFloat(eBP_RP)) || isNaN(parseInt(n)) ||
        MoH == '' || MG == '' || BP_RP == '' || eMG == '' || eMoH == '' || eBP_RP == '' || n == '' || parseFloat(n) == 0){
            $('#loading_div').css('top','0px');
            $("#loading_div").html('Error parsing inputs, check possible missing values.');
            return;
        }
    }

    $('body').addClass('waiting');
    $('#loading_div').css('top','0px');
    $('#loading_div').html('Computing estimation...');

    var [ages, median_age, mean_age, mode_age, age_std] = await estimate_age(model_name, MG, MoH, BP_RP, eMG, eMoH, eBP_RP, n);

    $('body').removeClass('waiting');
    $('#loading_div').css('top','-100px');
    $('#loading_bar').css('width','0%');

    display_age(ages);
    data[0].hovertext = mode_age.toFixed(2) + '±' + age_std.toFixed(2) + ' Gyr';
    data[0].hoverinfo = 'text';
    Plotly.redraw('hr_diagram');
    plot_age_distribution(ages);
    update_errors();
    if (zoomed_in){
        zoom_in_out();
        zoom_in_out();
    }

    // Automatically select the closest age_bin in the invisible histogram
    var closest_bin = Math.round(mode_age * 10) / 10; // Closest bin center
    var invisible_histogram = document.getElementById('age_distribution').data.filter(trace => trace.name === 'Hover Helper')[0];
    y = histogram_layout.yaxis.range[1];
    select_hist({ points: [{ x: closest_bin, y: y, data: { type: 'histogram' } }] }, 1);
    highlight_stars(closest_bin);
}

function display_age(ages,G_function=null){
    ages.sort((a, b) => a - b);
    var mid = Math.floor(ages.length / 2);
    var median = ages.length % 2 !== 0 ? ages[mid] : (ages[mid - 1] + ages[mid]) / 2;
    var mean = ages.reduce((a,b) => a + b, 0) / ages.length;
    var mode = get_max_occurence(ages)[0] / 10 + 0.05;
    var age_std = Math.sqrt(ages.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / ages.length);

    document.getElementById("result").innerHTML = 
    '<span>t<p class="underscore">mean,H(x)</p> = ' + mean.toFixed(2) +  ' ± ' + age_std.toFixed(2) + ' Gyr</span>' +
    '<span>t<p class="underscore">median,H(x)</p> = ' + median.toFixed(2) +  ' ± ' + age_std.toFixed(2) + ' Gyr</span>' +
    '<span>t<p class="underscore">mode,H(x)</p> = ' + mode.toFixed(2) + ' ± ' + age_std.toFixed(2) + ' Gyr</span>';

    if (G_function != null){
        var age_bins = [];
        for (var i = 0; i < G_function.length; i++) {
            var age = i / 10;
            age_bins.push(age);
        }
        var max_occurence = Math.max(...G_function);
        var mode = age_bins[G_function.indexOf(max_occurence)] + 0.05;
        var sum_G_function = G_function.reduce((a, b) => a + b, 0);
        var mean = age_bins.reduce((sum, a, i) => sum + a * G_function[i], 0) / sum_G_function;
        var median = 0;
        var cumulative = 0;
        for (var i = 0; i < G_function.length; i++) {
            cumulative += G_function[i];
            if (cumulative >= 0.5*sum_G_function){
                median = age_bins[i];
                break;
            }
        }
        var age_std = Math.sqrt(age_bins.reduce((sum, a, i) => sum + Math.pow(a - mean, 2) * G_function[i], 0) / sum_G_function);

        document.getElementById("result").innerHTML += '<br/>' +
        '<span>t<p class="underscore">mean,G(x)</p> = ' + mean.toFixed(2) +  ' ± ' + age_std.toFixed(2) + ' Gyr</span>' +
        '<span>t<p class="underscore">median,G(x)</p> = ' + median.toFixed(2) +  ' ± ' + age_std.toFixed(2) + ' Gyr</span>' +
        '<span>t<p class="underscore">mode,G(x)</p> = ' + mode.toFixed(2) + ' ± ' + age_std.toFixed(2) + ' Gyr</span>';
    }
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
        if (model.includes('_cut')){
            model = model.split('_')[0];
        }
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
            
            if (model.includes('_cut')){
                var new_x = [];
                var new_y = [];
                for (var j = 0; j < x.length; j++) {
                    if (x[j] < 1.25 && y[j] < 4.25){
                        new_x.push(x[j]);
                        new_y.push(y[j]);
                    }
                }
                x = new_x;
                y = new_y;
            }
            
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
        hoverinfo: 'skip',
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
        median_age = ages.length % 2 !== 0 ? ages[mid] : (ages[mid - 1] + ages[mid]) / 2;
        mean_age = ages.reduce((a,b) => a + b, 0) / ages.length;
        mode_age = get_max_occurence(ages)[0] / 10 + 0.05;
        age_std = Math.sqrt(ages.reduce((sum, a) => sum + Math.pow(a - mean_age, 2), 0) / ages.length);
        return [ages, median_age, mean_age, mode_age, age_std];
    } catch (error) {
        console.log(error);
    }
    
}

function plot_age_distribution(ages, histogram = null) {
    var traces = document.getElementById('age_distribution').data.length;
    if (traces > 0) {
        Plotly.deleteTraces('age_distribution', Array.from(Array(traces).keys()));
    }

    // Visible histogram trace
    var trace = {
        x: ages,
        type: 'histogram',
        xbins: {
            size: 0.1,
            start: 0,
            end: 14
        },
        autobinx: false,
        marker: {
            color: 'rgba(235, 232, 221,.75)'
            //color: 'rgba(0,0,0,0)'
        },
        hoverinfo: 'skip',
        name: 'Σ H(x)'
    };
    Plotly.addTraces('age_distribution', trace);

    var occs = get_max_occurence(ages);
    var max_value = occs[1];

    var fake_ages = [];
    for (var i = 0; i < 140; i++) {
        for (var j = 0; j < max_value; j++) {
            fake_ages.push(i/10);
        }
    }

    // Invisible histogram trace for hover behavior
    invisible_histogram = {
        x: fake_ages,
        type: 'histogram',
        xbins: {
            size: 0.1,
            start: 0,
            end: 14
        },
        autobinx: false,
        marker: {
            color: 'rgba(0,0,0,0)' // Fully transparent
        },
        hoverinfo: 'x', // Enable hover for this trace
        name: 'Hover Helper',
        showlegend: false // Hide from legend
    };
    Plotly.addTraces('age_distribution', invisible_histogram);

    if (histogram != null) {
        var ys = [];
        var hist_max = Math.max(...histogram);

        for (var i = 0; i < histogram.length; i++) {
            ys.push(i / 10);
            histogram[i] = histogram[i] / hist_max * max_value;
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
            hoverinfo: 'skip',
            name: 'Π G(x)'
        };

    
        Plotly.addTraces('age_distribution', trace);
        Plotly.relayout('age_distribution', {
            showlegend: true,
            'yaxis.range': [min_value, max_value]
        });
    } else {
        Plotly.relayout('age_distribution', {
            showlegend: false,
            'yaxis.range': [0, max_value]
        });
    }

    // Automatically select the closest age_bin in the invisible histogram
    var closest_bin = Math.round(occs[0]) / 10; // Closest bin center
    var invisible_histogram = document.getElementById('age_distribution').data.filter(trace => trace.name === 'Hover Helper')[0];
    y = histogram_layout.yaxis.range[1];
    select_hist({ points: [{ x: closest_bin, y: y, data: { type: 'histogram' } }] }, 1);
    highlight_stars(closest_bin);

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