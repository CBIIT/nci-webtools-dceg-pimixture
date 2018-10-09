testdata.check<-function(fit,test.data,data.type){
    fml<-as.formula(fit$p.model)
    var.list<-all.vars(fml)
    VALUE<-identical(names(test.data),var.list[-seq(1,3)])
    if(VALUE==TRUE){
      factor.var<-data.type$text[data.type$type=="nominal"]
      factor.ind<-which(names(test.data) %in% factor.var)
      factor.cat<-data.type$category[data.type$type=="nominal"]
      
      n.samp<-nrow(test.data)
      
      if(length(factor.ind)>0){
        for(i in factor.ind){
          test.data[,i]<-as.factor(test.data[,i])
        }
      }
      
      #######Set reference group ######################
      relevel.function<-function(x,y){
        xx<-factor.ind[x]
        ref.level<-which(levels(test.data[,xx]) %in% as.character(y))
        test.data[,xx] <- relevel(test.data[,xx], ref = ref.level)
        return(test.data)
      }
      #########################################
      if(length(factor.ind)>0){
        for(i in 1:length(factor.ind)){
          test.data<-relevel.function(i,factor.cat[i])
        }
      }
      return(test.data)
    }else{
      stop("The variable names of the test dataset do not match with the model")
    }
}
#If VALUE=TRUE, test.data is valid for prediction; otherwise, it is not valid for prediction.

########## Relabel function for prediction output #########################
predict.relabel<-function(test.data,time.points){


  collapse<-function(x){
    a<-x[1]
    for(i in 2:length(x)){
      a<-paste0(a,",",x[i])
    }
    return(a)
  }


  var.names<-names(test.data)

  if(nrow(test.data)>1){
    if(length(var.names)==1){
      relabel<-paste0(var.names,"=",test.data[,1])
    }else {
      relabel2<-t(apply(test.data,1, function(x) paste0(var.names,"=",x)))
      relabel<-apply(relabel2,1,collapse )
    }

  }else if(nrow(test.data)==1){
    if(length(var.names)==1){
      relabel<-paste0(var.names,"=",test.data)
    }else {
      relabel2<-relabel<-paste0(var.names,"=",test.data)
      relabel<-collapse(relabel2)
    }
  }

  output<-rep(relabel,each=length(time.points))

  return(output)
}

