########## function ##################################
data.conversion<-function(data.type=NULL,DATA,wght.info=NULL){
  if(!is.null(data.type)){
    numeric.var<-data.type$text[data.type$type=="continuous"]
    factor.var<-data.type$text[data.type$type=="nominal"]
    numeric.ind<-which(names(DATA) %in% numeric.var)
    factor.ind<-which(names(DATA) %in% factor.var)
    numeric.cat<-data.type$category[data.type$type=="continuous"]
    factor.cat<-data.type$category[data.type$type=="nominal"]

    n.samp<-nrow(DATA)

    #######Data Type######################
    if(length(numeric.ind)>1){
      DATA[,numeric.ind] = apply(DATA[,numeric.ind], 2, function(x) as.numeric(as.character(x)))
    }else if(length(numeric.ind)==1){
      DATA[,numeric.ind] = as.numeric(as.character(DATA[,numeric.ind]))
    }

    if(length(factor.ind)>0){
      for(i in factor.ind){
        DATA[,i]<-as.factor(DATA[,i])
      }
    }
    #######Set reference group ######################
    relevel.function<-function(x,y){
      xx<-factor.ind[x]
      ref.level<-which(levels(DATA[,xx]) %in% as.character(y))
      DATA[,xx] <- relevel(DATA[,xx], ref = ref.level)
      return(DATA)
    }
    #########################################
    if(length(factor.ind)>0){
      for(i in 1:length(factor.ind)){
        DATA<-relevel.function(i,factor.cat[i])
      }
    }
    if(length(numeric.ind)>0){
      for(i in 1:length(numeric.ind)){
        DATA[,numeric.ind[i]]<-DATA[,numeric.ind[i]]-rep(as.numeric(as.character(numeric.cat[i])),n.samp)
      }
    }
  }

  if(!is.null(wght.info)){
    wght.ind<-which(names(DATA) %in% wght.info$samp.weight)
    names(DATA)[wght.ind]<-"samp.weight"

    strata.ind<-which(names(DATA) %in% wght.info$strata)
    names(DATA)[strata.ind]<-"strata"
  }
 return(DATA)
}
