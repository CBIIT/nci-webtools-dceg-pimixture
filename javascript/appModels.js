appMixture.TemplatesModel = Backbone.Model.extend({
    url: 'templates/',
    fetch: function() {
        var $that = this,
            deferred = $.Deferred(),
            files = ['effects.html','effectsFooter.html','references.html','referencesFooter.html','results.html'],
            templates = {};
        var after = _.after(files.length,function() {
            $that.set(templates);
            deferred.resolve();
        });
        _.each(files,function(file) {
            $.get('templates/'+file).then(function(contents) {
                templates[file.slice(0,-5)] = contents;
                after();
            });
        });
        return deferred.promise();
    }
});

appMixture.BaseModel = Backbone.Model.extend({
    defaults: {
        'form': {},
        'results': {}
    }
});

appMixture.FormModel = Backbone.Model.extend({
    defaults: {
        'csvFile': null,
        'design': "",
        'model': "",
        'outcomeC': "",
        'outcomeL': "",
        'outcomeR': "",
        'covariates': "",
        'effects': [],
        'references': [],
        'email': ""
    }
});

appMixture.EffectsModel = Backbone.Model.extend({
    defaults: {
        'formModel': {},
        'covariates': [],
        'first': "",
        'second': "",
        'effects': []
    }
});

appMixture.ReferencesModel = Backbone.Model.extend({
    defaults: {
        'covariates': [],
        'formModel': {},
        'referenceGroup': {},
        'references': []
    }
});

appMixture.ResultsModel = Backbone.Model.extend({
    defaults: {
        'tables': {},
        'hazardimg': "",
        'riskimg': ""
    },
    url: 'results.json',
    //url: "/pimixtureRest/run",
    parse: function(response) {
        console.log(response);
        return response;
    }
});

