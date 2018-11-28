var appMixture = {
    events: {
        updateModel: function (e) {
            var e = $(e.target);
            if (e.attr('type') == 'checkbox') {
                this.model.set(e.attr('name') || e.attr('id'), e.prop('checked'));
            } else {
                this.model.set(e.attr('name') || e.attr('id'), !e.hasClass('selectized') ? e.val() : e.val().length > 0 ? e.val().split(',') : []);
            }
        }
    },
    models: {},
    views: {},
    variables: [
        'outcomeC',
        'outcomeL',
        'outcomeR',
        'strata',
        'weight'
    ],
    MAX_PAGES: 5,
    currentView: null,
    showView: function(view) {
        if (this.currentView !== null && this.currentView.cid !== view.cid) {
            this.currentView.$el.html("");
        }
        this.currentView = view;
        return view.render();
    }
};

const MAX_UNIQUE_VALUES = 20;
const QUEUE_DATA_THRESHOLD = 8000;
const QUEUE_COVARIATES_THRESHOLD = 20;

appMixture.FormView = Backbone.View.extend({
    tagName: 'div',
    className: 'col-lg-4',
    id: 'input',
    initialize: function () {
        this.template = _.template(appMixture.templates.get('form'), {
            'variable': 'data'
        });
        var $that = this;
        this.model.on({
            'change:headers': this.updateCovariateOptions,
            'change:design': this.changeDesign,
            'change:outcomeC': this.changeOutcomes,
            'change:outcomeL': this.changeOutcomes,
            'change:outcomeR': this.changeOutcomes,
            'change:weight': this.changeOutcomes,
            'change:strata': this.changeOutcomes,
            'change:covariatesSelection': this.changeCovariateList,
            'change:covariatesArrValid': this.changeCovariatesArrValid,
            'change:effects': this.changeEffectsList,
            'change:sendToQueue': this.changeQueueStatus,
            'change:email': this.validateEmail
        }, this);
    },
    events: {
        'click #reset': 'resetModel',
        'change input[type="file"]': 'uploadFile',
        'change input.selectized': 'updateModel',
        'change input[type="text"]': 'updateModel',
        'change input[type="checkbox"]': 'updateModel',
        'change select': 'updateModel',
        'click #effectsButton': 'openInteractiveEffects',
        'click #referencesButton': 'openReferenceGroups',
        'submit #calculationForm': 'runCalculation'
    },
    render: function() {
        // this.checkRemoteInputCSVFile();
        that = this;
        this.$el.html(this.template(this.model.attributes));
        this.$('[name="covariatesSelection"]').selectize({
            plugins: ['remove_button'],
            sortField: 'order',
            onInitialize: function(arg) {
                that.$('#selectized .selectize-input input').attr('id', 'covariate-selectized');
            }
        });
        this.$("[data-toggle=popover]").popover();
        this.updateCovariateOptions();
        this.initializeCovariates();
        this.initializePopovers();
        this.getNumMessages();
        return this;
    },
    checkRemoteInputCSVFile: function() {
        if (this.model.get('csvFile').name) {
            return;
        }
        $that = this;
        var remoteCSVFileName = this.model.get('remoteInputCSVFile');
        if (remoteCSVFileName) {
            var fileName = this.model.get('inputCSVFile');
            fetch(remoteCSVFileName).then(function(res){
                res.blob().then(function(blob){
                    var file = new File([blob], fileName);
                    $that.model.set('csvFile', file);
                    $that.model.unset('inputCSVFile');
                    $that.model.unset('remoteInputCSVFile');
                    $that.model.set('emailValidated', true);
                    $that.uploadFile();
                });
            });
        }
    },
    getNumMessages: function(){
        $that = this;
        fetch('numMessages').then(function(res){
            res.json().then(function(data){
                if (data.numMessages) {
                    $that.$('#numMessages').html('(Jobs currently enqueued: ' + data.numMessages + ')');
                }
            });
        }).catch(function(err){
            console.error(err);
        });
    },
    initializePopovers: function() {
        this.$('#jobNamePopover').popover({title: "Job Name", content:"Optional job name will be prepend to result file names, if not entered, default name will be 'PIMixture'", container:"body",trigger: "focus", container: "body", html: true});
        this.$('#inputFilePopover').popover({title: "Input File", content: 'Input file should be in CSV (comma-separated values) format.',  trigger:"focus", container:"body", html: true});
        this.$('#designPopover').popover({title: "Weighted and Unweighted Data",
            content: '<p>PIMixture provides two options for unweighted and weighted data. Specifically, unweighted data represents a simple random sample or an entire cohort; everyone of a simple random sample has an equal selection probability, so we don’t have to add sampling weight. Weighted data in PIMixture represents a stratified random sample, of which selection probabilities vary across strata and are the same within a stratum, and the selection probabilities are known. For weighted data analysis, users additionally specify two variables for strata and sampling weights (>=1).</p>' +
            '<p>1. Table 1 Available options of PIMixture</p>' +
            '<table class="table table-condense table-bordered"><thead><tr><th></th><th>Parametric models</th><th>Weakly-parametric models</th><th>Semiparametric models</th></tr></thead>' +
            '<tr><th>Unweighted data (a simple random sample or a cohort)</th><td>Available</td><td>Available</td><td>Available (standard error and confidence interval are not available)</td></tr>' +
            '<tr><th>Weighted data (stratified random sample with known sample weights)</th><td>Not available</td><td>Available</td><td>Available (standard error and confidence interval are not available)</td></tr></table>',
            trigger:"focus", container:"body", html: true});
        this.$('#modelPopover').popover({title: "Parametric, weakly-parametric, semiparametric",
            content: '<p>In PIMixture, logistic regression is used to model disease prevalence and proportional hazards models are used for disease incidence subject to interval-censoring; model parameters are then jointly estimated to account for disease where it is uncertain whether it is prevalent or incident.</p>' +
            '<p>The PIMixture web tool provides multiple options for defining the baseline hazard of the proportional hazard model -- a fully parametric model that assumes a Weibull baseline hazard; a weakly-parametric model that uses integrated B-splines to model the baseline hazard; and a semi-parametric model.  Both the weakly-parametric model and the semiparametric model also supports stratified random sample.</p>',
            trigger:"focus", container:"body", html: true});
        this.$('#strataPopover').popover({title: "Strata", content: '',  trigger:"focus", container:"body", html: true});
        this.$('#weightPopover').popover({title: "Weight", content: '',  trigger:"focus", container:"body", html: true});
        this.$('.outcomePopover').popover({title: "Outcome variables: C, L and R",
            content: 'The outcome of interest is the time of clinically-detectable disease onset, and three variables for the outcome should be included in the input data: for simplicity, we define C=prevalence indicator, L=left time point, i.e. the latest time at which a subject is disease-free, R=right time point, i.e., the earliest time at which a subject is diagnosed with a disease. These variable names can be changed. In the webtool, users can choose which variables correspond to “C”, “L” and “R”. General coding rules are as following: ' +
            '<ol><li>C=1 if prevalent disease, C=0 if no prevalent disease, C=-999 if unknown status.  Note that even if disease status is not ascertained at the initial screen, a later screen that ascertains the absence of disease means we know there was no prevalent disease.</li>' +
            '<li>L and R have values equal to or greater than 0 (any unit, such as day, month and year can be used); however, when C=1, L=R=-999.</li>' +
            '<li>For right/interval censoring, L is smaller than R.</li>' +
            '<li>For right censoring, R=Inf, where Inf means infinity, <img src="images/image024.png"></li>' +
            '<li>L should not be equal to R except when C=1 because PIMixture does not handle exact event time. However, if data includes exact event times, users can use a trick, adding a very small interval to the exact event times to define “L” and “R”.</li></ol>' +
            'Note that examples and explanations are provided in the manual.',
            trigger:"focus", container:"body", html: true});
        this.$('#covariatePopover').popover({title: "Predictors", content: 'In PIMixture, it is optional to include predictors in logistic and proportional hazards models. When included, relative risks are given in terms of odd ratios for prevalent disease and hazard ratios for incident disease. There are two options for predictors, continuous or categorical variables. Examples and explanations are provided in the manual.',  trigger:"focus", container:"body", html: true});
        this.$('#queuePopover').popover({title: "Queue", content: 'A job sent to queue will run in background, and send you an email when the computation finishes.',  trigger:"focus", container:"body", html: true});
        this.$('#emailPopover').popover({title: "Email", content: 'A valid email is needed for a job sent to queue.',  trigger:"focus", container:"body", html: true});
    },
    initializeCovariates: function(){
        covariatesSelection = this.$('[name="covariatesSelection"]')[0].selectize;
        var covariates = this.model.get('covariatesSelection');
        if (covariates) {
            var covList = covariates.split(',');
            for (var cov of covList) {
                covariatesSelection.addItem(cov, true);
            }
            this.updateCovariateBtnsStatus(covList);
        }
    },
    runCalculation: function (e) {
        e.preventDefault();
        if (!this.model.get('isMutuallyExclusive')) {
            this.$('#mutex-error').html('Please make sure variables are mutually exclusive!');
            return;
        }
        if (!this.model.get('covariatesArrValid')) {
            this.$('#covariates-error').html('Some of the Covariates are not properly configured.');
            return;
        }
        if (this.model.get('sendToQueue') && !this.model.get('emailValidated')) {
            this.$('#email-error').html('Please enter a valid email address!');
            return;
        }
        appMixture.models.results.clear().set(appMixture.models.results.defaults);
        var $that = this,
            params = _.extend({}, this.model.attributes);
        var formData = new FormData();
        if (params.covariatesSelection) {
            params.covariatesSelection = params.covariatesSelection.split(',');
            if (params.effects && params.effects.length > 0) {
                var effects = [];
                for (var effect of this.model.get('effects')) {
                    effects.push([effect.first, effect.second])
                }
                params.effects = effects;
            }
        } else {
            params.covariatesSelection = [];
        }
        if (params.uniqueValues) {
            delete params.uniqueValues;
        }
        formData.append('csvFile', params.csvFile);
        delete params.csvFile;
        params.hostURL = window.location.href.split('#')[0];
        formData.append('jsonData', JSON.stringify(params));
        this.startSpinner();
        appMixture.models.results.fetch({
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            type: "POST",
            success: function(model, res, options) {
                $that.stopSpinner();
                $that.getNumMessages();
            },
            error: function(model, res, options) {
                $that.stopSpinner();
                $that.getNumMessages();
                var result = res.responseJSON;
                if (result) {
                    appMixture.models.results.set('errors', result.message);
                } else {
                    var error = res.responseText.replace(/\\n/g, '<br>');
                    error = error.replace(/^"(.*)"\n$/, '$1');
                    error = error.replace(/\\"/g, '"');
                    appMixture.models.results.set('errors', error);
                }
            }
        });
    },
    startSpinner: function() {
        $('body').append('<div id="overlay"></div>');
        var target = $('#overlay')[0];
        if (this.spinner) {
            this.spinner.spin(target);
        } else {
            var opts = {
                lines: 13, // The number of lines to draw
                length: 38, // The length of each line
                width: 17, // The line thickness
                radius: 45, // The radius of the inner circle
                scale: 1, // Scales overall size of the spinner
                corners: 1, // Corner roundness (0..1)
                color: '#ffffff', // CSS color or array of colors
                fadeColor: 'transparent', // CSS color or array of colors
                speed: 1, // Rounds per second
                rotate: 0, // The rotation offset
                animation: 'spinner-line-fade-quick', // The CSS animation name for the lines
                direction: 1, // 1: clockwise, -1: counterclockwise
                zIndex: 2e9, // The z-index (defaults to 2000000000)
                className: 'spinner', // The CSS class to assign to the spinner
                top: '50%', // Top position relative to parent
                left: '50%', // Left position relative to parent
                shadow: '0 0 1px transparent', // Box-shadow for the lines
                position: 'absolute' // Element positioning
            };
            this.spinner = new Spinner(opts).spin(target);
        }
    },
    stopSpinner: function() {
        this.spinner.stop();
        $('#overlay').remove();
    },
    resetModel: function(e) {
        this.model.clear({silent: true}).set(this.model.defaults, {silent: true});
        appMixture.models.results.clear({silent: true}).set(appMixture.models.results.defaults, {silent: true});
        this.render();
        appMixture.views.results.render();
    },
    openInteractiveEffects: function (e) {
        e.preventDefault();
        new appMixture.InteractiveEffectsView({
            model: new appMixture.EffectsModel({
                'formModel': this.model,
                'covariatesSelection': this.model.get('covariatesSelection'),
                'effects': this.model.get('effects').slice()
            })
        });
    },
    openReferenceGroups: function (e) {
        e.preventDefault();
        new appMixture.ReferenceGroupsView({
            model: new appMixture.ReferencesModel({
                'covariatesArr': this.model.get('covariatesArr').map(function(cov) {
                    return _.extend({}, cov);
                }),
                'uniqueValues': this.model.get('uniqueValues'),
                'formModel': this.model,
            })
        });
    },
    checkQueueThresholds: function() {
        const numLines = this.model.get('inputLines');
        const covariates = this.model.get('covariatesSelection');
        var numCovariates = 0;
        if (covariates) {
            numCovariates = covariates.split(',').length;
        }
        this.$('[name="sendToQueue"]').prop('disabled', false);
        this.$('[name="email"]').prop('required', false);
        if (numCovariates >= QUEUE_COVARIATES_THRESHOLD || numLines >= QUEUE_DATA_THRESHOLD) {
            this.model.set('sendToQueue', true);
            this.model.set('queueMandatory', true);
            this.$('[name="sendToQueue"]').prop('checked', true);
            this.$('[name="sendToQueue"]').prop('disabled', true);
            this.$('[name="email"]').prop('disabled', false);
            this.$('[name="email"]').prop('required', true);
        }
    },
    uploadFile: function (e) {
        if (e) {
            e.preventDefault();
        }
        var $that = this;
        if (Papa) {
            var file = null;
            if (e) {
                file = e.target.files[0];
            } else if (this.model.get('csvFile').name) {
                file = this.model.get('csvFile');
            }

            if (file) {
                Papa.parse(file, {
                    complete: function(results) {
                        if (results.data && results.data.length > 0) {
                            var lines = results.data;
                            var headers = lines[0];
                            var uniqueValues = {};
                            for (var j = 0; j < headers.length; ++j) {
                                uniqueValues[headers[j]] = new Set();
                            }
                            for (var i = 1; i < lines.length; ++i) {
                                for (var j = 0; j < headers.length; ++j) {
                                    if (uniqueValues[headers[j]].size < MAX_UNIQUE_VALUES) {
                                        if (lines[i][j]) {
                                            uniqueValues[headers[j]].add(lines[i][j]);
                                        }
                                    }
                                }
                            }

                            for (var field in uniqueValues) {
                                if (uniqueValues.hasOwnProperty(field)) {
                                    var allNum = true;
                                    for (var value of uniqueValues[field]) {
                                        if (isNaN(value) && value.toLowerCase() !== 'inf') {
                                            allNum = false;
                                            break;
                                        }
                                    }
                                    uniqueValues[field] = {
                                        allNum: allNum,
                                        values: Array.from(uniqueValues[field])
                                    };
                                }
                            }
                            $that.enableInputs();
                            $that.$('[name="covariatesSelection"]')[0].selectize.destroy();
                            $that.$('[name="covariatesSelection"]').selectize({
                                plugins: ['remove_button'],
                                sortField: 'order'
                            });

                            $that.model.unset('headers', {silent: true});

                            $that.model.set({
                                'csvFile': file,
                                'inputLines': lines.length,
                                'headers': headers.sort(),
                                'uniqueValues': uniqueValues
                            });
                            $that.checkQueueThresholds();
                        }
                    }
                });

                this.$('#csvFileName').html(file.name);
            } else {
                $that.model.set({
                    'csvFile': null,
                    'headers': null
                });
            }
        }
    },
    enableInputs: function() {
        this.$('[name="design"], [name="model"], [name="outcomeC"], [name="outcomeL"], '
            + '[name="outcomeR"], [name="covariatesSelection"], [name="sendToQueue"], '
            + '[name="jobName"], [name="weight"], [name="strata"], #run, #reset'
        ).prop('disabled', false);
        this.$('#csvFileBtn').prop('disabled', true);
    },
    updateModel: function (e) {
        e.preventDefault();
        var e = $(e.target),
            name = e.prop('name'),
            val = e.val();
        if (name.length < 1) return;
        switch (e.prop('type')) {
            case 'checkbox':
                val = e.prop('checked') || false;
                break;
            default:
                if (val === "null") val = null;;
                if (!Number.isNaN(parseInt(val))) val = parseInt(val);
                break;
        }

        this.model.set(name, val);

        if (appMixture.variables.indexOf(name) != -1) {
            this.checkMutuallyExclusive();
        }
    },
    checkMutuallyExclusive: function() {
        this.model.set('isMutuallyExclusive', true);
        this.$('#mutex-error').html('');
        for (var name of appMixture.variables) {
            this.$('#' + name).removeClass('has-error');
        }

        for (var i = 0; i < appMixture.variables.length; ++i) {
            var name1 = appMixture.variables[i];
            var val1 = this.model.get(name1);
            if (val1) {
                for (var j = i + 1; j < appMixture.variables.length; ++j) {
                    var name2 = appMixture.variables[j];
                    var val2 = this.model.get(name2);
                    if (val2 && val1 === val2) {
                        this.$('#' + name1).addClass('has-error');
                        this.$('#' + name2).addClass('has-error');
                        this.model.set('isMutuallyExclusive', false);
                        this.$('#mutex-error').html('Please make sure variables are mutually exclusive!');
                    }
                }
            }
        }
    },
    changeQueueStatus: function() {
        this.$('[name="email"]').prop('disabled', !this.model.get('sendToQueue'));
        this.$('[name="email"]').prop('required', this.model.get('sendToQueue'));
    },
    changeCovariateList: function () {
        var model = this.model,
            covariatesSelection = this.model.get('covariatesSelection');
        this.checkQueueThresholds();
        var covariatesSelectionSplit = [];
        if (covariatesSelection && covariatesSelection !== "") {
            covariatesSelectionSplit = covariatesSelection.split(',');
            var covariatesArrNew = [];
            var covariatesArr = model.get('covariatesArr');

            _.each(covariatesSelectionSplit, function (covariate) {
                var item = _.find(covariatesArr, function (covariateObj) {
                    return covariateObj.text === covariate;
                });
                if (item) {
                    covariatesArrNew.push(item);
                } else {
                    covariatesArrNew.push({
                        text: covariate,
                        type: '',
                        category: ''
                    });
                }
            });
            model.set('covariatesArr', covariatesArrNew);
            if (_.difference(covariatesArrNew, covariatesArr).length) {
                model.set('covariatesArrValid', false);
            }
        } else {
            model.set('covariatesArr', []);
            model.set('covariatesArrValid', true);
        }

        var effects = this.model.get('effects').filter(function(effect) {
            return covariatesSelectionSplit.indexOf(effect.first) !== -1 &&
                covariatesSelectionSplit.indexOf(effect.second) !== -1;
        });
        this.model.set('effects', effects);

        this.updateCovariateBtnsStatus(covariatesSelectionSplit);
    },
    updateCovariateBtnsStatus: function(covList) {
      if (covList.length > 1) {
            this.$el.find('#effectsButton').prop("disabled", false);
            this.$el.find('#referencesButton').prop("disabled", false);
        } else {
            this.$el.find('#effectsButton').prop("disabled", true);
            if (covList.length === 0) {
                this.$el.find('#referencesButton').prop("disabled", true);
            } else {
                this.$el.find('#referencesButton').prop("disabled", false);
            }
        }
    },
    changeCovariatesArrValid: function() {
        if (this.model.get('covariatesArrValid')) {
            this.$('#covariates-error').html('');
        }
    },
    changeEffectsList: function () {
        return; // Don't display current interactive effects in form
        var model = this.model;
        var effects = appMixture.models.form.attributes.effects;
        var effects_String = "";
        counter = 1;
        _.each(effects, function (val, attribute) {
            if (counter <= 5)
                effects_String += "<p>" + val.first + " &nbsp " + val.second + "</p>";
            counter++;
        });
        $("#effects").html(effects_String);
    },
    changeDesign: function () {
        this.$el.find('[name="model"] option:last-child').prop('disabled',(this.model.get('design') === 1));
        var design = this.model.get('design');
        if (design === "") {
        } else {
            var modelSelect = this.$el.find('[name="model"]')[0];
            if ($(modelSelect.options[modelSelect.selectedIndex]).attr('disabled') !== undefined) {
                modelSelect.selectedIndex = 0;
                this.model.set('model','');
            }
            this.displayExtraMappings(design === 1);
        }
    },
    displayExtraMappings: function(status) {
        if (!status) {
            this.model.unset('strata', {silent: true});
            this.model.unset('weight', {silent: true});
            this.$('[name="strata"] option:selected').prop('selected', false);
            this.$('[name="weight"] option:selected').prop('selected', false);
            this.checkMutuallyExclusive();
        }
        this.$('[name="strata"]').prop('required', status);
        this.$('[name="weight"]').prop('required', status);
        this.$('#Strata, #Weight').prop('hidden', !status);
    },
    validateEmail: function () {
        var email = this.model.get('email');
        this.$('#email-error').html('');
        this.model.set('emailValidated', false);
        if ( email && email.length > 0) {
            email = email.trim();
            if (!email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/)) {
                this.$('#email-error').html('Please enter a valid email address!');
                this.model.set('emailValidated', false);
            } else {
                this.model.set('emailValidated', true);
            }
        }
    },
    resetGroup: function () {
        this.model.set('groupValue', []);
    },
    updateCovariateOptions: function () {
        var headers = this.model.get('headers');
        var selected = [];
        var covariatesSelection = this.$el.find('[name="covariatesSelection"]')[0].selectize;
        for (var i = 0; i < appMixture.variables.length; ++i) {
            var value = this.model.get(appMixture.variables[i]);
            var optionsList = this.getOptionTags(headers, [], value, appMixture.variables[i]);
            this.$el.find('[name="' + appMixture.variables[i] + '"]').html(optionsList);
            if (value) {
                selected.push(value);
                covariatesSelection.removeOption(value); 
            }  
        }

        for (var opt of _.difference(headers, selected)) {
            covariatesSelection.addOption({'text': opt, 'value': opt});
        }
    },
    getOptionTags: function(options, selected, current, name) {
        var optionsList = '<option value="">----Select ' + name + '----</option>';
        for (var index = 0; index < options.length; index++) {
            if (selected.indexOf(options[index]) === -1) {
                optionsList += '<option value="' + options[index] + '"';
                if (options[index] === current) {
                    optionsList += ' selected ';
                }
                optionsList += '>' + options[index] + '</option>';
            }
        }
        return optionsList;
    },
    changeOutcomes: function() {
        var covariatesSelection = this.$el.find('[name="covariatesSelection"]')[0].selectize;
        var selected = [];
        for (var i = 0; i < appMixture.variables.length; ++i) {
            var value = this.model.get(appMixture.variables[i]);
            if (value) {
                selected.push(value);
                covariatesSelection.removeOption(value); 
            }  
        }
        var headers = this.model.get('headers');
        options = _.difference(headers, selected).map(function (e) {
            return {
                'text': e,
                'value': e
            };
        });
        covariatesSelection.addOption(options);
    }
});

appMixture.InteractiveEffectsView = Backbone.View.extend({
    initialize: function () {
        this.template = _.template(appMixture.templates.get('effects'));
        this.model.on({
            'change:effects': this.rerenderFooter,
            'change:first': this.rerenderSelects,
            'change:second': this.rerenderSelects
        }, this);
        this.render();
    },
    events: {
        'hidden.bs.modal': 'remove',
        'change select': 'updateModel',
        'click #add-effects': 'addEffect',
        'click .remove-effects': 'removeEffect',
        'click .modal-footer button.save': 'save',
        'click .modal-footer button:not(.save)': 'close'
    },
    addEffect: function (e) {
        var model = this.model,
            first = model.get('first'),
            second = model.get('second'),
            effects = model.get('effects');
        effects.push({
            'first': first < second ? first : second,
            'second': first < second ? second : first
        });
        model.set({
            'first': '',
            'second': ''
        });
        model.trigger('change:effects', model);
    },
    close: function (e) {
        e.preventDefault(e);
        this.$modal.close();
    },
    removeEffect: function (e) {
        var effects = this.model.get('effects');
        effects.splice(parseInt(e.currentTarget.dataset.index), 1);
        this.model.trigger('change:effects', this.model);
    },
    save: function (e) {
        e.preventDefault(e);
        this.model.get('formModel').set('effects', this.model.get('effects'));
        this.close.call(this, e);
    },
    updateModel: appMixture.events.updateModel,
    render: function () {
        this.$modal = BootstrapDialog.show({
            buttons: [{
                cssClass: 'btn-primary save',
                label: 'Save'
            }, {
                cssClass: 'btn-primary',
                label: 'Close'
            }],
            message: $(this.template(this.model.attributes)),
            title: "Enter Interactive Effects"
        });
        this.setElement(this.$modal.getModal());
        this.rerenderSelects.apply(this);
        this.rerenderFooter.apply(this);
    },
    rerenderSelects: function () {
        var model = this.model,
            effects = model.get('effects'),
            first = model.get('first'),
            second = model.get('second'),
            firstList = model.get('covariatesSelection').split(',').filter(function (entry) {
                return entry !== second;
            }),
            secondList = model.get('covariatesSelection').split(',').filter(function (entry) {
                return entry !== first;
            }),
            eF = this.$el.find('[name="first"]'),
            eS = this.$el.find('[name="second"]'),
            selectedIndex = 0;
        eF.empty().append($('<option>', {
            text: "---Select Covariate---",
            value: ""
        }));
        firstList.forEach(function (entry, index) {
            if (entry === first) selectedIndex = index + 1;
            eF.append($('<option>', {
                text: entry,
                value: entry
            }));
        });
        eF[0].selectedIndex = selectedIndex;
        selectedIndex = 0;
        eS.empty().append($('<option>', {
            text: "---Select Covariate---",
            value: ""
        }));
        secondList.forEach(function (entry, index) {
            if (entry === second) selectedIndex = index + 1;
            eS.append($('<option>', {
                text: entry,
                value: entry
            }));
        });
        eS[0].selectedIndex = selectedIndex;
        first = this.model.get('first');
        second = this.model.get('second');
        var alreadyInserted = effects.length > 0 ? effects.filter(function (entry) {
            return entry.first == (first < second ? first : second) && entry.second == (first < second ? second : first);
        }).length > 0 : false;
        if (first === '' || second === '' || alreadyInserted) {
            this.$('#add-effects').prop('disabled', true);
        } else {
            this.$('#add-effects').prop('disabled', false);
        }
    },
    rerenderFooter: function () {
        this.$el.find('tbody').empty().append(_.template(appMixture.templates.get('effectsFooter'))(this.model.attributes));
    }
});

appMixture.ReferenceGroupsView = Backbone.View.extend({
    initialize: function () {
        this.template = _.template(appMixture.templates.get('references'));
        this.model.on({
            'change:covariatesArr': this.render
        }, this);
        this.showModal();
    },
    events: {
        'hidden.bs.modal': 'remove',
        'change select': 'updateModel',
        'change input[type="number"]': 'updateModel',
        'click .modal-footer button.save': 'save',
        'click .modal-footer button:not(.save)': 'close'
    },
    close: function(e) {
        e.preventDefault(e);
        this.$modal.close();
    },
    save: function(e) {
        e.preventDefault(e);
        this.model.get('formModel').set('covariatesArr', this.model.get('covariatesArr'));
        this.model.get('formModel').set('covariatesArrValid', true);
        this.close.call(this, e);
    },
    updateModel: function(e) {
        var model = this.model,
            input = $(e.target),
            covariatesArr = model.get('covariatesArr'),
            name = (input.attr('name') || input.attr('id')).split('_'),
            value = input.val(),
            type = name.splice(name.length-1,1)[0];
        name = name.join('_');

        var covariateObj = _.find(covariatesArr, function (obj) {
            return obj.text === name;
        });
        covariateObj[type] = input.val();
        if (type === 'type') {
            if (value === 'continuous') {
                covariateObj.category = '0';
            } else {
                covariateObj.category = '';
            }
        }
        this.validate();
        model.trigger('change:covariatesArr', model);
    },
    validate: function() {
        var properties = ['text', 'type', 'category'];
        this.model.set('valid', true);
        for (var cov of this.model.get('covariatesArr')) {
            for (var prop of properties) {
                if (!cov[prop]) {
                    this.model.set('valid', false);
                    break;
                }
            }
        }
        this.$('#saveCovariatesBtn').prop('disabled', !this.model.get('valid'));
    },
    render: function() {
        this.$modal.setMessage($(this.template(this.model.attributes)));
    },
    showModal: function() {
        this.$modal = BootstrapDialog.show({
            buttons: [{
                id: 'saveCovariatesBtn',
                cssClass: 'btn-primary save',
                label: 'Save'
            }, {
                cssClass: 'btn-primary',
                label: 'Cancel'
            }],
            message: $(this.template(this.model.attributes)),
            title: "Configure Covariates"
        });
        this.setElement(this.$modal.getModal());
        this.validate();
    }
});

appMixture.ResultsView = Backbone.View.extend({
    tagName: 'div',
    className: 'col-lg-8',
    id: 'output',
    events: {
        'click #runPredictionBtn': 'navigateToPrediction'
    },
    navigateToPrediction: function(e) {
        e.preventDefault();
        appMixture.models.prediction.clear().set(appMixture.models.prediction.defaults);
        appMixture.models.prediction.set('serverFile', this.model.get('Rfile'));
        appMixture.models.prediction.set('jobName', this.model.get('jobName'));
        appMixture.models.prediction.set('maxTimePoint', this.model.get('maxTimePoint'));
        if (appMixture.models.predictionResultModel) {
            appMixture.models.predictionResultModel.clear().set(appMixture.models.predictionResultModel.defaults);
        }
        appMixture.router.navigate('#prediction', true);
    },
    initialize: function () {
        this.model.on({
            'change': this.render
        }, this);
        this.template = _.template(appMixture.templates.get('results'), {
            'variable': 'data'
        });
    },
    render: function () {
        this.$el.html(this.template(this.model.attributes));
        return this;
    }
});

appMixture.PredictionView = Backbone.View.extend({
    el: '#prediction-tool',
    events: {
        'input #rdsFile': 'selectModelFile',
        'input #testDataFile': 'selectTestDataFile',
        'input [type="number"]': 'updateModel',
        'input [type="text"]': 'updateModel',
        'click #reset': 'resetForm',
        'submit #predictionForm':'onSubmitPredict',
        'click #timePointRange': 'changeTimePointType',
        'click #timePointList': 'changeTimePointType'
    },
    initialize: function () {
        this.template = _.template(appMixture.templates.get('prediction'), {
            'variable': 'data'
        });

        this.model.on({
            'change:results': this.render,
            'change:maxTimePoint': this.updateMaxTimePoint
        }, this);

        appMixture.models.predictionResultModel = new appMixture.PredictionResultModel();
    },
    render: function () {
        this.checkRemoteRFile();
        this.$el.html(this.template(this.model.attributes));
        this.$("[data-toggle=popover]").popover();
        this.tryEnableInputs();
        appMixture.predictionResultView = new appMixture.PredictionResultView({model: appMixture.models.predictionResultModel});
        this.$el.append(appMixture.predictionResultView.render().el);
        this.initializePopovers();
        return this;
    },
    checkRemoteRFile: function() {
        $that = this;
        var remoteRFileName = this.model.get('remoteRFile');
        var fileName = this.model.get('fileName');
        if (remoteRFileName) {
            fetch(remoteRFileName).then(function(res){
               res.blob().then(function(blob){
                   var file = new File([blob], fileName);
                   $that.model.set('rdsFile', file);
                   $that.model.unset('remoteRFile');
                   $that.selectModelFile();//upload remote file to server
               });
            });
        }
    },
    initializePopovers: function() {
        this.$('#testDataPopover').popover({title: "Prediction", content: 'Based on the regression parameters and/or cumulative hazard function, we can predict prevalence and incidence using an independent data (called test data) including the predictors used for estimating the parameters and cumulative hazard function. For prediction, users need to upload fitted model, test data and input time points. When time point=0, predicted probabilities mean the prevalences of subgroups characterized by specific predictors; when time point=t>0, predicted cumulative risk up to time t includes prevalence too. Test data should include the same variables used for fitting the model.',  trigger:"focus", container:"body", html: true});
        this.$('#modelFilePopover').popover({title: "Model File", content: 'Upload model (.RDS) file downloaded from "Fitting" page',  trigger:"focus", container:"body", html: true});
        this.$('#timePointTypePopover').popover({title: "Time Point Type", content: 'You can enter time points as a range (default), or enter discrete time points manually.',  trigger:"focus", container:"body", html: true});
        this.$('#beginPopover').popover({title: "Begin", content: 'First time point you\'d like to use as time points',  trigger:"focus", container:"body", html: true});
        this.$('#endPopover').popover({title: "End", content: 'Last time point you\'d like to use as time points',  trigger:"focus", container:"body", html: true});
        this.$('#stepSizePopover').popover({title: "Step Size", content: 'Step size between consecutive time points',  trigger:"focus", container:"body", html: true});
        this.$('#timePointsPopover').popover({title: "Time Points", content: 'Enter discreet time points manually',  trigger:"focus", container:"body", html: true});
    },
    selectModelFile: function(e) {
        var $that = this;
        var file = this.model.get('rdsFile');
        if (e) {
            file = e.target.files[0];
        }
        if (file) {
            var formData = new FormData();
            formData.append('rdsFile', file);
            this.model.fetch({
                data: formData,
                cache: false,
                contentType: false,
                processData: false,
                type: "POST",
                success: function(model, res, options) {
                    appMixture.models.predictionResultModel.unset('errors');
                },
                error: function(model, res, options) {
                    console.log(res.responseText);
                    appMixture.models.predictionResultModel.set('errors', res.responseText);
                }
            });
            this.model.set('rdsFile', file);
            this.$('#modelFileName').html(file.name);
            this.$('#modelFileBtn').prop('disabled', true);
            this.tryEnableInputs();
        }
    },
    updateMaxTimePoint: function(e) {
        var maxTimePoint = this.model.get('maxTimePoint');
        this.$('#end').prop('max', maxTimePoint);
        this.$('#begin').prop('max', maxTimePoint);
    },
    selectTestDataFile: function(e) {
        var file = e.target.files[0];
        if (file) {
            this.model.set('testDataFile', file);
            this.$('#testDataFileName').html(file.name);
            this.$('#testDataFileBtn').prop('disabled', true);
            this.tryEnableInputs();
        }
    },
    updateModel: function(e) {
        var val = $(e.target).val();
        var name = $(e.target).attr('name');
        this.model.set(name, val);
        if (name === 'timePoints') {
            var points = val.split(',').map(function(point) { return point.trim()} );
            for (var point of points) {
                if (point) {
                    if (!this.validateTimePoint(point, 'timePointsError', this.$('#timePointsError'))) {
                        return;
                    }
                }
            }
        }

        if (name === 'begin') {
            if (this.validateTimePoint(val, 'beginError', this.$('#beginError'))) {
                this.$('#end').prop('min', val);
            }
        } else if (name === 'end') {
            this.validateTimePoint(val, 'endError', this.$('#endError'))
        }
    },
    validateTimePoint: function(point, errorField, errorElement) {
        this.model.unset(errorField);
        if (errorElement.html) {
            errorElement.html('');
        }
        var num = parseInt(point);
        var maxTimePoint = this.model.get('maxTimePoint');
        var error = '';
        if (Number.isNaN(num)) {
            error = 'Invalid time point "' + point + '"';
            this.model.set(errorField, error);
            if (errorElement.html) {
                errorElement.html(error);
            }
            return false;
        } else if (num > maxTimePoint) {
            error = 'Time point can\'t be greater than "' + maxTimePoint + '"';
            this.model.set(errorField, error);
            if (errorElement.html) {
                errorElement.html(error);
            }
            return false;
        }
        return true;
    },
    tryEnableInputs: function() {
        var modelFileSelected = this.model.get('serverFile');
        if (!modelFileSelected) {
            modelFileSelected = this.model.get('rdsFile').name;
        }
        var testDataFileSelected = this.model.get('testDataFile').name;
        if (modelFileSelected || testDataFileSelected) {
            this.$('#reset').prop('disabled', false);
        }
        if (modelFileSelected && testDataFileSelected) {
            this.$('#timePointsWell').prop('disabled', false);
            this.$('#runPredict').prop('disabled', false);
        }
    },
    resetForm: function(e) {
        appMixture.models.predictionResultModel.clear({silent: true}).set(appMixture.models.predictionResultModel.defaults, {silent: true});
        this.model.clear({silent: true}).set(this.model.defaults, {silent: true});
        this.render();
    },
    onSubmitPredict: function (e) {
        e.preventDefault();
        if (this.model.get('timePointType') === 'List' && this.model.get('timePointsError')) {
            return;
        } else if (this.model.get('timePointType') === 'Range' &&
            (this.model.get('beginError') || this.model.get('endError'))) {
            return;
        }
        var $that = this;
        var formData = new FormData();
        var jsonData = {};

        var serverFile = this.$('[name="serverFile"]').val() || this.model.get('serverFile');
        var uploadedFile = this.model.get('uploadedFile');
        if (serverFile) {
            jsonData["serverFile"] = serverFile;
            jsonData['jobName'] = this.model.get('jobName');
        } else if (uploadedFile) {
            jsonData["uploadedFile"] = uploadedFile;
            this.model.unset('uploadedFile');
            jsonData['jobName'] = this.model.get('jobName');
        } else if (this.model.get('rdsFile')) {
            formData.append('rdsFile', this.model.get('rdsFile'));
            jsonData['jobName'] = this.model.get('rdsFile').name.replace(/\.rds$/, '');
        } else {
            appMixture.models.predictionResultModel.set('errors', 'Please choose a valid model file!');
            return;
        }

        if (this.model.get('testDataFile')) {
            formData.append('testDataFile', this.model.get('testDataFile'));
        } else {
            appMixture.models.predictionResultModel.set('errors', 'Please choose a valid test data file!');
            return;
        }

        if (this.model.get('timePointType') === 'List') {
            jsonData.timePoints = this.model.get('timePoints').split(',');
        } else {
            jsonData["begin"] = this.model.get('begin');
            jsonData["end"] = this.model.get('end');
            jsonData["stepSize"] = this.model.get('stepSize');
        }
        formData.append('jsonData', JSON.stringify(jsonData));

        appMixture.models.predictionResultModel.clear({silent: true}).set(appMixture.models.predictionResultModel.defaults, {silent: true});
        appMixture.predictionResultView.render();
        this.startSpinner();
        appMixture.models.predictionResultModel.fetch({
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            type: "POST",
            success: function(model, res, options) {
                $that.stopSpinner();
            },
            error: function(model, res, options) {
                $that.stopSpinner();
                if (res.status == 410) { // rds file on server doesn't exist anymore
                    var redirect = confirm("Model file on server doesn't exist anymore!\nUpload a new model file?");
                    if (redirect) {
                        console.log("Redirect");
                        appMixture.router.navigate('#prediction', true);
                        return;
                    } else {
                        console.log("Stay");
                    }
                }

                if (res.responseText) {
                    var error = res.responseText.replace(/\\n/g, '<br>');
                    error = error.replace(/^"(.*)"\n$/, '$1');
                    error = error.replace(/\\"/g, '"');
                    error = 'Error message from R package:<br>' + error;
                    appMixture.models.predictionResultModel.set('errors', error);
                }
            }
        });
    },
    changeTimePointType: function(e) {
        if (e.target.id === "timePointRange") {
            this.model.set('timePointType', 'Range');
            this.$('#timePointsRangeGroup').prop('hidden', false);
            this.$('#timePointsRangeGroup input').prop('required', true);
            this.$('#timePointsListGroup').prop('hidden', true);
            this.$('#timePointsListGroup input').prop('required', false);
        } else if (e.target.id === "timePointList") {
            this.model.set('timePointType', 'List');
            this.$('#timePointsListGroup').prop('hidden', false);
            this.$('#timePointsListGroup input').prop('required', true);
            this.$('#timePointsRangeGroup').prop('hidden', true);
            this.$('#timePointsRangeGroup input').prop('required', false);
        }
    },
    startSpinner: function() {
        $('body').append('<div id="overlay"></div>');
        var target = $('#overlay')[0];
        if (this.spinner) {
            this.spinner.spin(target);
        } else {
            var opts = {
                lines: 13, // The number of lines to draw
                length: 38, // The length of each line
                width: 17, // The line thickness
                radius: 45, // The radius of the inner circle
                scale: 1, // Scales overall size of the spinner
                corners: 1, // Corner roundness (0..1)
                color: '#ffffff', // CSS color or array of colors
                fadeColor: 'transparent', // CSS color or array of colors
                speed: 1, // Rounds per second
                rotate: 0, // The rotation offset
                animation: 'spinner-line-fade-quick', // The CSS animation name for the lines
                direction: 1, // 1: clockwise, -1: counterclockwise
                zIndex: 2e9, // The z-index (defaults to 2000000000)
                className: 'spinner', // The CSS class to assign to the spinner
                top: '50%', // Top position relative to parent
                left: '50%', // Left position relative to parent
                shadow: '0 0 1px transparent', // Box-shadow for the lines
                position: 'absolute' // Element positioning
            };
            this.spinner = new Spinner(opts).spin(target);
        }
    },
    stopSpinner: function() {
        this.spinner.stop();
        $('#overlay').remove();
    }
});

appMixture.PredictionResultView = Backbone.View.extend({
    tagName: 'div',
    id: 'results',
    className: 'col-lg-8',
    events: {
        'input #pageSize': 'changePageSize',
        'click .sortByColumn': 'sort',
        'click .pageNav': 'changePage'
    },
    initialize: function() {
        this.template = _.template(appMixture.templates.get('predictionResults'), {
            'variable': 'data'
        });
        this.model.on({
            'change:results change:end change:start change:errors': this.render
        }, this);
    },
    changePageSize: function(e) {
        var pageSize = parseInt(e.target.value);
        var resultLength = 0;
        if (this.model.get('results') && this.model.get('results').prediction) {
            resultLength = this.model.get('results').prediction.length;
        }
        var pages = Math.ceil(resultLength / pageSize);
        var pageNum = Math.floor(this.model.get('start') / pageSize) + 1;
        this.model.set('pageSize', pageSize, {silent: true});
        this.model.set('pages', pages, {silent: true});
        this.model.set('pageNum', pageNum, {silent: true});
        this.calculatePageBoundaries();
    },
    changePage: function(e) {
        e.preventDefault();
        var pageNum = parseInt(e.target.dataset.pageNum);
        if (pageNum && pageNum >= 1 && pageNum <= this.model.get('pages')) {
            this.model.set('pageNum', pageNum, {silent: true});
            this.calculatePageBoundaries();
        }
    },
    calculatePageBoundaries: function() {
        var pageNum = this.model.get('pageNum');
        var pageSize = this.model.get('pageSize');
        var resultLength = 0;
        if (this.model.get('results') && this.model.get('results').prediction) {
            resultLength = this.model.get('results').prediction.length;
        }
        var start = (pageNum -1) * pageSize;
        var end = pageNum * pageSize;
        var end = end > resultLength ? resultLength : end;
        this.model.set('start', start, {silent: true});
        this.model.set('end', end, {silent: true});
        this.model.trigger('change:end', this.model);
    },
    calculateNeighborPages: function() {
        var currentPage = this.model.get('pageNum');
        var start = currentPage - Math.floor(appMixture.MAX_PAGES / 2);
        if (start < 1) {
            start = 1;
        }
        var end = start + appMixture.MAX_PAGES -1;
        if (end > this.model.get('pages')) {
            var emptySpace = end - this.model.get('pages');
            end = this.model.get('pages');
            start -= emptySpace;
            if (start < 1) {
                start = 1;
            }
        }
        var pages = [];
        for (var i = start; i <= end; ++i) {
            pages.push(i);
        }
        this.model.set('neighborPages', pages, {silent: true});
    },
    sort: function(e){
        var column = e.currentTarget.dataset['column'];
        var order = 'asc';
        if (column === this.model.get('column')) {
            if (this.model.get('order') === 'asc') {
                order = 'desc';
            } else {
                order = 'asc';
            }
        }

        this.model.set('column', column);
        this.model.set('order', order);
        this.model.get('results').prediction.sort(function(a, b) {
            if (a[column] < b[column]) {
                return order === 'asc' ? -1 : 1;
            } else if (a[column] > b[column]) {
                return order === 'asc' ? 1 : -1;
            } else {
                return 0;
            }
        });
        this.render();
    },
    render: function() {
        this.calculateNeighborPages();
        this.$el.html(this.template(this.model.attributes));
        if (this.model.get('column')) {
            var selecter = '[data-column="' + this.model.get('column') + '"] .fas';
            var icon = this.model.get('order') === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
            this.$(selecter).removeClass('fa-sort').addClass(icon);
            this.$(selecter).css('color', 'blue');
        }
        return this;
    }
});

appMixture.BaseView = Backbone.View.extend({
    el: '#main-tool',
    render: function() {
        appMixture.views.form = new appMixture.FormView({
            model: this.model.get('form')
        });
        appMixture.views.results = new appMixture.ResultsView({
            model: this.model.get('results')
        });
        this.$el.append(appMixture.views.form.render().el);
        this.$el.append(appMixture.views.results.render().el);
        return this;
    }
});

appMixture.HomeView = Backbone.View.extend({
    el: '#home-page',
    initialize: function() {
        this.template = _.template(appMixture.templates.get('home'), {
            'variable': 'data'
        });
    },
    render: function() {
        this.$el.html(this.template())
    }
});

appMixture.HelpView = Backbone.View.extend({
    el: '#help-tool',
    initialize: function() {
        this.template = _.template(appMixture.templates.get('help'), {
            'variable': 'data'
        });
    },
    render: function() {
        this.$el.html(this.template())
    }
});

appMixture.Router = Backbone.Router.extend({
    routes: {
        '': 'home',
        'help': 'help',
        'fitting': 'fitting',
        'prediction?parameters=:parameters': 'prediction',
        'prediction': 'prediction'
    },
    menus: ['home', 'help', 'fitting', 'prediction'],
    home: function() {
        this.activeMenu('home');
        appMixture.showView(appMixture.views.home);
        console.log('Home page!');
    },
    help: function() {
        this.activeMenu('help');
        appMixture.showView(appMixture.views.help);
        console.log('Help page!');
    },
    prediction: function(params) {
        this.activeMenu('prediction');
        if (params) {
            var paramObj = JSON.parse(params);
            if(paramObj) {
                if (paramObj['covariatesSelection']) {
                    paramObj['covariatesSelection'] = paramObj['covariatesSelection'].join(',');
                }
                if (paramObj['effects'] && paramObj['effects'].length > 0) {
                    paramObj['effects'] = paramObj['effects'].map(function(effect){
                       return {first: effect[0], second: effect[1]};
                    });
                }

                // appMixture.models.form.set(paramObj, {silent: true});
                var remoteRFile = paramObj.remoteRFile;
                var fileName = paramObj.fileName;
                if (remoteRFile) {
                    appMixture.models.prediction.set('remoteRFile', remoteRFile);
                }
                if(fileName) {
                    appMixture.models.prediction.set('fileName', fileName);
                }
            }
        }

        appMixture.showView(appMixture.views.prediction);
    },
    fitting: function() {
        this.activeMenu('fitting');
        appMixture.showView(appMixture.views.base);
    },
    activeMenu: function(target) {
        for (var menu of this.menus) {
            var id = '#' + menu + '-li';
            if (menu === target) {
                $(id).addClass('active');
            } else {
                $(id).removeClass('active');
            }
        }
    }
});

$(function () {
    Number.prototype.countDecimals = function () {
        if (Math.floor(this.valueOf()) === this.valueOf()) return 0;
        return this.toString().split(".")[1].length || 0;
    };
    appMixture.router = new appMixture.Router();
    appMixture.templates = new appMixture.TemplatesModel();
    appMixture.templates.fetch().done(function () {
        appMixture.models.form = new appMixture.FormModel();
        appMixture.models.results = new appMixture.ResultsModel();
        appMixture.models.prediction = new appMixture.PredictionModel();
        appMixture.models.base = new appMixture.BaseModel({
            'form': appMixture.models.form,
            'results': appMixture.models.results
        });
        appMixture.views.base = new appMixture.BaseView({
            model: appMixture.models.base
        });
        appMixture.views.prediction = new appMixture.PredictionView({
            model: appMixture.models.prediction
        });
        appMixture.views.home = new appMixture.HomeView();
        appMixture.views.help = new appMixture.HelpView();
        Backbone.history.start();
    });
});
