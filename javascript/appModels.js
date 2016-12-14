appMixture.TemplatesModel = Backbone.Model.extend({
    url: 'templateList'
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
    url: "run",
    parse: function(response) {
        console.log(response);
        return response;
    }
});

