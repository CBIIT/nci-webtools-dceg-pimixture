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
        'headers': [],
        'model': "",
        'outcomeC': "",
        'outcomeL': "",
        'outcomeR': "",
        'covariatesSelection': "",
        'covariatesArr': [],
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
        'references': {}
    }
});

appMixture.ResultsModel = Backbone.Model.extend({
    defaults: {
        'data.summary': {},
        'cumulative.hazard': {
          'min.time': 0,
          'max.time': 1,
          'value': [],
          'Rfile':""
        },
        'riskimg': "images/risk.png"
    },
    url: "run",
    parse: function(response) {
        appMixture.ResultsModel.prototype.defaults.Rfile=response.Rfile
        console.log(appMixture.ResultsModel.prototype.defaults.Rfile);

        return response;
    }
});

