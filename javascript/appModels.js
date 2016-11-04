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
        'groupTrigger': "",
        'groupValue': [],
        'email': ""
    }
});

appMixture.ResultsModel = Backbone.Model.extend({
    defaults: {
        'tables': {},
        'hazardimg': "",
        'riskimg': ""
    },
    'url': "results.json"
});
