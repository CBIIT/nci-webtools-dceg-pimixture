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
        this.$('#jobNamePopover').popover({title: "Job Name", content:"Optional job name will be prepended to result file names, if not entered, default name will be 'PIMixture'", container:"body",trigger: "focus", container: "body", html: true});
        this.$('#inputFilePopover').popover({title: "Input File", content: 'Input file should be in CSV (comma-separated values) format.',  trigger:"focus", container:"body", html: true});
        this.$('#designPopover').popover({title: "Weighted and Unweighted Data",
            content: '<p>PIMixture provides two options for unweighted and weighted data. Specifically, unweighted data represents a simple random sample or an entire cohort; everyone of a simple random sample has an equal selection probability, so we don\'t have to add sampling weight. Weighted data in PIMixture represents a stratified random sample, of which selection probabilities vary across strata and are the same within a stratum, and the selection probabilities are known. For weighted data analysis, users additionally specify two variables for strata and sampling weights (>=1).</p>' +
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
            content: 'The outcome of interest is the time of clinically-detectable disease onset, and three variables for the outcome should be included in the input data: for simplicity, we define C=prevalence indicator, L=left time point, i.e. the latest time at which a subject is disease-free, R=right time point, i.e., the earliest time at which a subject is diagnosed with a disease. These variable names can be changed. In the webtool, users can choose which variables correspond to "C", "L" and "R". General coding rules are as following: ' +
            '<ol><li>C=1 if prevalent disease, C=0 if no prevalent disease, C=-999 if unknown status.  Note that even if disease status is not ascertained at the initial screen, a later screen that ascertains the absence of disease means we know there was no prevalent disease.</li>' +
            '<li>L and R have values equal to or greater than 0 (any unit, such as day, month and year can be used); however, when C=1, L=R=-999.</li>' +
            '<li>For right/interval censoring, L is smaller than R.</li>' +
            '<li>For right censoring, R=Inf, where Inf means infinity, <img src="images/image024.png"></li>' +
            '<li>L should not be equal to R except when C=1 because PIMixture does not handle exact event time. However, if data includes exact event times, users can use a trick, adding a very small interval to the exact event times to define "L" and "R".</li></ol>' +
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
                                        if (isNaN(value) && value.toLowerCase() !== 'inf' && value.toLowerCase() !== 'na') {
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
                            function setIdForSelectize() {
                                $that.$('#selectized .selectize-input input').attr('id', 'covariate-selectized');
                            }
                            $that.$('[name="covariatesSelection"]').selectize({
                                plugins: ['remove_button'],
                                sortField: 'order',
                                onInitialize: setIdForSelectize,
                                onChange: setIdForSelectize
                            });

                            $that.model.unset('headers', {silent: true});

                            $that.model.set({
                                'csvFile': file,
                                'inputLines': lines.length,
                                'headers': headers.sort(function(a, b){
                                    var la = a.toLowerCase();
                                    var lb = b.toLowerCase();
                                    if (la < lb) {
                                        return -1;
                                    } else if (la > lb) {
                                        return 1;
                                    } else {
                                        return 0;
                                    }
                                }),
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