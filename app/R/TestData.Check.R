testdata.check<-function(fit,test.data,data.type){
    fml<-as.formula(fit$p.model)
    var.list<-all.vars(fml)
    VALUE<-identical(sort(names(test.data)),sort(var.list[-seq(1,3)]))
    
    if(VALUE==TRUE){
      factor.var<-data.type$text[data.type$type=="nominal"]
      factor.ind<-which(names(test.data) %in% factor.var)
     
      # factor.cat<-data.type$category[data.type$type=="nominal"]
      n.samp<-nrow(test.data)
      
      if(length(factor.ind)>0){
        
        for(i in factor.ind){
          test.data[,i]<-as.factor(test.data[,i])
          ref.ind<-which(data.type$text==names(test.data)[i])
          test.data[,i]<-relevel(test.data[,i],ref=as.character(data.type$category[ref.ind]) )
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
    if(ncol(test.data)>1){
      relabel1<-apply(relabel,1 ,function(x) paste0(x,collapse=","))
      relabel<-data.frame(relabel1)
    }
  }else if(nrow(test.data)==1){
    var.names<-names(test.data)
    relabel<-paste0(var.names,"=",test.data)
    if(ncol(test.data)>1){
      relabel<-paste0(relabel,collapse=",")
    }
  }
  
  output<-as.data.frame(lapply(data.frame(relabel), function(x) rep(x,each=length(time.points))))
  names(output)<-"Label"
  
  if(nrow(test.data)>1&ncol(test.data)==1){
    output<-data.frame(Label=as.character(as.matrix(output)))
  }
  return(output)
}
