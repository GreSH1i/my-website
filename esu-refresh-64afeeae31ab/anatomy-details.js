(() => {
  'use strict';
  // Artistic vascular arborisation for the illustrative lung view.
  // The main organ geometry is from HRA; these small branches are not clinical data.
  function merge(tubes) {
    let count=0,indexCount=0;
    tubes.forEach(g=>{count+=g.attributes.position.count;indexCount+=g.index.count;});
    const positions=new Float32Array(count*3), normals=new Float32Array(count*3), indices=new Uint32Array(indexCount);
    let vertex=0,index=0;
    tubes.forEach(g=>{
      positions.set(g.attributes.position.array,vertex*3);normals.set(g.attributes.normal.array,vertex*3);
      for(const value of g.index.array)indices[index++]=value+vertex;
      vertex+=g.attributes.position.count;g.dispose();
    });
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setIndex(new THREE.BufferAttribute(indices,1));
    return geometry;
  }
  function lungs(model) {
    model.updateMatrixWorld(true);
    const b=new THREE.Box3().setFromObject(model), size=b.getSize(new THREE.Vector3());
    const root=new THREE.Group();root.add(model);
    const tubes=[];let seed=7919;
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    function tube(points,radius){tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),7,radius,5,false));}
    function tree(start,targets,level,radius){
      const center=targets.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(targets.length);
      const end=start.clone().lerp(center,level===0?1:.6);
      const middle=start.clone().lerp(end,.5);middle.z+=radius*1.3;
      tube([start,middle,end],radius);
      if(level===0||targets.length<3)return;
      const box=new THREE.Box3().setFromPoints(targets), extent=box.getSize(new THREE.Vector3());
      const axis=extent.x>extent.y?(extent.x>extent.z?'x':'z'):(extent.y>extent.z?'y':'z');
      targets.sort((a,b)=>a[axis]-b[axis]);const half=Math.floor(targets.length/2);
      tree(end,targets.slice(0,half),level-1,radius*.7);
      tree(end,targets.slice(half),level-1,radius*.7);
    }
    for(const side of [-1,1]){
      const targets=[];
      while(targets.length<170){
        const x=random()*2-1,y=random()*2-1,z=random()*2-1;
        if(x*x+y*y+z*z>.88)continue;
        targets.push(new THREE.Vector3(side*size.x*.255+x*size.x*.215,y*size.y*.4,z*size.z*.36));
      }
      const origin=new THREE.Vector3(side*size.x*.1,size.y*.26,0);
      tree(origin,targets,7,.036);
      tube([new THREE.Vector3(0,size.y*.48,0),new THREE.Vector3(0,size.y*.36,0),origin],.06);
    }
    const material=new THREE.MeshStandardMaterial({color:new THREE.Color(0xca5d5a).convertSRGBToLinear(),roughness:.46,metalness:.01});
    root.add(new THREE.Mesh(merge(tubes),material));
    const trachea=new THREE.CatmullRomCurve3([new THREE.Vector3(0,size.y*.68,0),new THREE.Vector3(0,size.y*.55,0),new THREE.Vector3(0,size.y*.4,0)]);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(trachea,16,.085,12,false),material));
    const ringMaterial=new THREE.MeshStandardMaterial({color:0xb8a19c,roughness:.55});
    // Rings are a separate instanced mesh to keep the number of draw calls low.
    const ringGeometry=new THREE.TorusGeometry(.084,.009,5,20);ringGeometry.rotateX(Math.PI/2);
    const instanced=new THREE.InstancedMesh(ringGeometry,ringMaterial,14), matrix=new THREE.Matrix4();
    for(let i=0;i<14;i++){matrix.makeTranslation(0,size.y*(.42+.019*i),0);instanced.setMatrixAt(i,matrix);}
    root.add(instanced);
    root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(root), longest=Math.max(...bounds.getSize(new THREE.Vector3()).toArray());
    const centered=new THREE.Group();root.position.sub(bounds.getCenter(new THREE.Vector3()));centered.add(root);centered.scale.setScalar(3.55/longest);
    return centered;
  }
  function vessels(model) {
    model.updateMatrixWorld(true);
    const root=new THREE.Group();root.add(model);
    const tubes=[],ray=new THREE.Raycaster();let seed=1349;
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    function branch(start,end,radius,depth,side){
      const middle=start.clone().lerp(end,.5);middle.y+=.04;middle.z+=.015;
      tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start,middle,end]),7,radius,5,false));
      if(!depth)return;
      for(const turn of [-1,1]){
        const tip=end.clone().add(new THREE.Vector3(side*(.09+random()*.17),turn*(.04+random()*.29)+(.5-random())*.18,(.5-random())*.26));
        branch(end,tip,radius*.64,depth-1,side);
      }
    }
    for(const side of [-1,1])for(const y of [.2,-.25,-.65]){
      ray.set(new THREE.Vector3(side*2.5,y,0),new THREE.Vector3(-side,0,0));
      const hits=ray.intersectObject(model,true);
      if(!hits.length)continue;
      const anchor=hits[0].point.clone();
      const end=anchor.clone().add(new THREE.Vector3(side*.2,.08,(.5-random())*.1));
      branch(anchor,end,.023,5,side);
    }
    if(tubes.length)root.add(new THREE.Mesh(merge(tubes),new THREE.MeshStandardMaterial({color:new THREE.Color(0xc04a4e).convertSRGBToLinear(),roughness:.43,metalness:.01})));
    return root;
  }
  window.EsuAnatomyDetails={lungs,vessels};
})();
