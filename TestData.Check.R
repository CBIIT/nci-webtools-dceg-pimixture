testdata.check<-function(fit,test.data,data.type){
    fml<-as.formula(fit$p.model)
    var.list<-all.vars(fml)
    VALUE<-identical(sort(names(test.data)),sort(var.list[-seq(1,3)]))
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

predict.relabel<-function(test.data,time.points){
  
  if(nrow(test.data)>1){
    var.names<-colnames(test.data)
    relabel<-t(apply(test.data,1, function(x) paste0(var.names,"=",x)))
  }else if(nrow(test.data)==1){
    var.names<-names(test.data)
    relabel<-paste0(var.names,"=",test.data)
  }
  
  output<-as.data.frame(lapply(data.frame(relabel), rep, length(time.points)))
  return(output)
}
