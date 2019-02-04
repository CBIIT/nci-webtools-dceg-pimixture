
appMixture.Router = Backbone.Router.extend({
    routes: {
        '': 'redirect_to_home',
        'home': 'home',
        'help': 'help',
        'fitting': 'fitting',
        'prediction?parameters=:parameters': 'prediction',
        'prediction': 'prediction'
    },
    menus: ['home', 'help', 'fitting', 'prediction'],
    redirect_to_home: function() {
        this.navigate('home', true);
    },
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
                var id = paramObj.id;
                var jobName = paramObj.jobName;
                if (remoteRFile) {
                    appMixture.models.prediction.set('remoteRFile', remoteRFile);
                }
                if(fileName) {
                    appMixture.models.prediction.set('fileName', fileName);
                }
                if(id) {
                    appMixture.models.prediction.set('id', id);
                }
                if(jobName) {
                    appMixture.models.prediction.set('jobName', jobName);
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