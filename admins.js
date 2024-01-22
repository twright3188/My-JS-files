const express = require("express");
const router = express.Router();
const db = require("../models");
const {Op, Sequelize} = require("sequelize");

const Users = db.users;
const Products = db.products;
const ProductContents = db.productContents;
const ProductHistories = db.productHistories;
const SalesHistories = db.salesHistories;
const Togethers = db.togethers;
const Points = db.points;
const Angcols = db.angcols;
const Commits = db.commits;
const Favorites = db.favorites;
const Invites = db.invites;
const Reports = db.reports;
/*****************************************************************************************************************************
 * * * * * * * * * * * * * * * * *                        회원관리                        * * * * * * * * * * * * * * * * * * *
 *****************************************************************************************************************************/
/**
 * 회원통계 -> 총 회원수, 총 판매자수, 총 구매자수, Android앱, ios앱
 */
router.all("/users-statistic", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 관리자에 의한 회원통계 " );
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분만이 이 요청을 하실수 있습니다']});

        let totals = await Users.count({
            where: {
                role: "user",
                deleted: null
            }
        });
        let androids = await Users.count({
            where: {
                role: "user",
                deleted: null,
                device_type: "android",
            }
        });
        let ioss = await Users.count({
            where: {
                role: "user",
                deleted: null,
                device_type: "ios",
            }
        });
        let productUsers = await Products.findAll({
            where: {
                deleted: null,
                product_role: "product",
            },
            include: [{
                as: "saleUser",
                model: Users,
                where: { deleted: null, },
                required: true,
            }],
            attributes: ['id','user_id'],
        });
        let len_product = [];
        for ( let k = 0; k < productUsers.length; k ++ ) {
            len_product.push( productUsers[k].user_id);
        }
        len_product = [ ...new Set( len_product ) ];
        let purchaseUsers = await SalesHistories.findAll({
            where: {
                deleted: null,
            },
            include: [{
                as: "purchaseUser",
                model: Users,
                where: { deleted: null, },
                required: true,
            }],
            attributes: ['id','user_id'],
        });
        let len_purchase = [];
        for ( let k = 0; k < purchaseUsers.length; k ++ ) {
            len_purchase.push( purchaseUsers[k].user_id);
        }
        len_purchase = [ ...new Set( len_purchase ) ];
        let counts = {
            totals: totals,
            androids: androids,
            ioss: ioss,
            productUsers: len_product.length,
            purchaseUsers: len_purchase.length,
        };
        return res.status(200).json( { status: true, results: counts } );
    } catch (e) {
        return res.status(200).json( { status: false, msg: [ e.toString() ] } );
    }
} );

/**
 * 회원관리
 * start: 시작날짜
 * end: 마감날짜
 * user_role: 판매자이면 sale, 아니면 null,
 * device_type: ios, android
 * keyword_type: 1 -> 이름, 2 -> 닉네임, 3 -> 전화번호, 4 -> 주소
 * keyword
 */
router.all( "/users", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 관리자에 의한 회원관리 " );
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분만이 이 요청을 하실수 있습니다']});

        db.users.hasMany(db.products,);
        const pagination = req.body.pagination ? parseInt(req.body.pagination) : 10;
        const page_number = req.body.current_page ? parseInt(req.body.current_page) : 1;
        /** 회원수 얻기 **/
        let total_counts = await Users.findAll({
            where: {
                role: "user",
                deleted: null,
                name: (req.body.keyword_type === 1 && req.body.keyword ) ? req.body.keyword.toLowerCase() : { [Op.ne]: null },
                nickname: (req.body.keyword_type === 2 && req.body.keyword ) ? req.body.keyword.toLowerCase() : { [Op.ne]: null },
                phone: (req.body.keyword_type === 3 && req.body.keyword ) ? req.body.keyword.toLowerCase() : { [Op.ne]: null },
                [Op.or]: (req.body.keyword_type === 4 && req.body.keyword ) ?
                    [ { address: {[Op.like]: "%" + req.body.keyword.toLowerCase() + "%"}, }, { address_detail: {[Op.like]: "%" + req.body.keyword.toLowerCase() + "%"}, } ]
                    :
                    [ { address: { [ Op.ne ]: null } } ],
                device_type: req.body.device_type ? req.body.device_type.toLocaleString() : { [Op.ne]: null },
                created:
                    req.body.start ?
                        req.body.end ?
                            { [Op.gte]: new Date( req.body.start ).toUTCString(), [Op.lte]: new Date(req.body.end ).toUTCString(), }
                            :
                            { [Op.gte]: new Date( req.body.start ).toUTCString(), }
                        :
                        req.body.end ?
                            { [Op.lte]: new Date(req.body.end ).toUTCString(), }
                            :
                            { [Op.ne]: null, }
            },
            include: [{
                as: "products",
                model: Products,
                where: {
                    deleted: null,
                    product_role: "product",
                },
                required: req.body.user_role === "sale"
            }],
        });

        const total_pages = Math.ceil(total_counts.length / pagination);
        let users = await Users.findAll({
            where: {
                role: "user",
                deleted: null,
                name: (req.body.keyword_type === 1 && req.body.keyword ) ? req.body.keyword.toLowerCase() : { [Op.ne]: null },
                nickname: (req.body.keyword_type === 2 && req.body.keyword ) ? req.body.keyword.toLowerCase() : { [Op.ne]: null },
                phone: (req.body.keyword_type === 3 && req.body.keyword ) ? req.body.keyword.toLowerCase() : { [Op.ne]: null },
                [Op.or]: (req.body.keyword_type === 4 && req.body.keyword ) ?
                    [ { address: {[Op.like]: "%" + req.body.keyword.toLowerCase() + "%"}, }, { address_detail: {[Op.like]: "%" + req.body.keyword.toLowerCase() + "%"}, } ]
                    :
                    [ { address: { [ Op.ne ]: null } } ],
                device_type: req.body.device_type ? req.body.device_type.toLocaleString() : { [Op.ne]: null },
                created:
                    req.body.start ?
                        req.body.end ?
                            { [Op.gte]: new Date( req.body.start ).toUTCString(), [Op.lte]: new Date(req.body.end ).toUTCString(), }
                            :
                            { [Op.gte]: new Date( req.body.start ).toUTCString(), }
                        :
                        req.body.end ?
                            { [Op.lte]: new Date(req.body.end ).toUTCString(), }
                            :
                            { [Op.ne]: null, }
            },
            include: [{
                as: "products",
                model: Products,
                where: {
                    deleted: null,
                    product_role: "product",
                },
                attributes: ['id', 'created'],
                required: req.body.user_role === "sale"
            }],
            offset: (page_number - 1) * pagination,
            limit: pagination,
            order: [['created', "DESC"]],
            attributes: ['id', 'created', 'last_connected', 'nickname', 'name', 'phone', 'address', 'address_detail', 'points', 'eccumulated', 'device_type',]
        });

        /**
         * 총 회원수
         */

        let temp = {
            totals: total_counts.length,
            total_pages: total_pages,
            users: users,
        };
        return res.status(200).json( { status: true, results: temp } );
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
} );

router.all("/delete-user", async (req, res) => {
    try {
        console.log( req.body, " = 관리자에 의한 사용자 삭제하기 ");
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['이 요청은 관리자분만이 하실수 있습니다'] });
        if ( !req.body.user_id )
            return res.status(200).json({ status: false, msg: ['삭제할 사용자를 선택하세요']});
        let temp = await Users.findOne({
            where: {
                role: "user",
                deleted: null,
                id: Number( req.body.user_id ),
            }
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['이러한 사용자는 존재하지 않습니다']});
        else {
            await Users.update({
                deleted: new Date(),
            }, {
                where: {
                    id: Number( req.body.user_id ),
                }
            });
            return res.status(200).json({ status: true, msg: ['선택된 사용자가 성공적으로 삭제되었습니다']});
        }
    } catch (e) {
        return res.status(200).json({status: false, msg: [e.toString()]});
    }
});
/*****************************************************************************************************************************
 * * * * * * * * * * * * * * * * *                        판매현황                        * * * * * * * * * * * * * * * * * * *
 *****************************************************************************************************************************/
/**
 * 판매통계 -> 총 상품 등록수, 총 거래건수, 총 판매금액
 */
router.all( "/product-statistic", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 관리자에 의한 판매통계얻기 " );
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분만이 이 요청을 하실수 있습니다']});
        let totals = await Products.count({
            where: {
                product_role: "product",
                deleted: null,
            },
        });
        let purchases = await SalesHistories.findOne({
            where: { deleted: null },
            attributes: [
                [Sequelize.fn('sum', Sequelize.col('payment_amount')), 'total_amount'],
                [Sequelize.fn('count', Sequelize.col('id')), 'count']
            ],
        });

        purchases['dataValues'] = Object.assign( {}, purchases['dataValues'], { totals: totals } );
        return res.status(200).json( { status: true, results: purchases } );
    } catch (e) {
        return res.status(200).json( { status: false, msg: [ e.toString() ] } );
    }
} );
/**
 * 판매현황
 * start: 시작날짜
 * end: 마감날짜
 * state: 공구 상태, progressing -> 진행, end -> 종료
 * keyword_type: 1 -> 이름, 2 -> 닉네임, 3 -> 전화번호, 4 -> 주소, 5 -> 상품명
 * 전체인 경우엔 keywordType없이
 */
router.all( "/sales", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 판매현황 " );
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분만이 이 요청을 하실수 있습니다']});

        let list = [];
        /**
         * 진행중/픽업 및 배달상태의 공구
         */
        let stateArray = [];
        if ( req.body.state === "progressing" )
            stateArray = [ 1, 2, 3 ];
        else if ( req.body.state === "end" )
            stateArray = [ 4, 5 ];
        else if ( req.body.state )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});
        else
            stateArray = [ 1, 2, 3, 4, 5 ];

        list = await Products.findAll({
            where: {
                product_role: "product",
                state: stateArray,
                deleted: null,
                name: ( req.body.keyword_type === 5  && req.body.keyword ) ? {[Op.like]: "%" + req.body.keyword + "%"} : { [Op.or]: [{[Op.ne]: null }, null ] },
                created:
                    req.body.start ?
                        req.body.end ?
                            { [Op.gte]: new Date( req.body.start ).toUTCString(), [Op.lte]: new Date(req.body.end ).toUTCString(), }
                            :
                            { [Op.gte]: new Date( req.body.start ).toUTCString(), }
                        :
                        req.body.end ?
                            { [Op.lte]: new Date(req.body.end ).toUTCString(), }
                            :
                            { [Op.ne]: null, }
            },
            include: [{
                as: "saleUser",
                model: Users,
                where: {
                    deleted: null,
                    name: ( req.body.keyword_type === 1  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                    nickname: ( req.body.keyword_type === 2  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                    phone: ( req.body.keyword_type === 3  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                    [Op.or]: (req.body.keyword_type === 4 && req.body.keyword ) ?
                        [ { address: {[Op.like]: "%" + req.body.keyword.toLowerCase() + "%"}, }, { address_detail: {[Op.like]: "%" + req.body.keyword.toLowerCase() + "%"}, } ]
                        :
                        [ { address: { [ Op.ne ]: null } } ],
                },
                required: true,
                attributes: ['id', 'name', 'nickname', 'phone', 'business_num', 'address', 'address_detail' ],
            }, {
                as: 'productHistories',
                model: ProductHistories,
                required: false,
                attributes: ['id', 'product_id', 'settlement_date', 'brokerage_fee',],
            }],
            order: [['created', 'DESC']],
            attributes: ['id', 'state', 'user_id', 'created', 'finish_date', 'name', 'details', 'brokerage_fee' ],
        });

        const pagination  = req.body.pagination ? parseInt(req.body.pagination) : 10;
        const page_number = req.body.current_page ? parseInt(req.body.current_page) : 1;
        const total_pages = Math.ceil(list.length / pagination);

        list = list.splice((page_number - 1) * pagination, pagination );
        for ( let i = 0; i < list.length; i ++ ) {
            let total_payment_amounts = 0;
            let total_amounts = 0;
            let brokerage_fee = 0;
            let card_fee = 0;
            let purchaseCounts = 0;
            let discounts = 0;
            let apply_points = 0;

            /** 진행중인 내역만 **/
            let purchases = await SalesHistories.findOne({
                where: {
                    deleted: null,
                    old_product_id: null,
                    product_id: Number( list[ i ].id ),
                },
                attributes: [
                    [Sequelize.fn('count', Sequelize.col('id')), 'counts'],
                    [Sequelize.fn('sum', Sequelize.col('payment_amount')), 'total_payment_amounts'],
                    [Sequelize.fn('sum', Sequelize.col('discount')), 'discount'],
                    [Sequelize.fn('sum', Sequelize.col('apply_point')), 'apply_points'],
                ],
            });

            purchaseCounts = Number( purchases['dataValues'].counts || 0 );
            total_payment_amounts = purchases['dataValues'].total_payment_amounts || 0;
            total_amounts = total_payment_amounts + ( purchases['dataValues'].discount || 0 );       // 총 판매금액
            brokerage_fee = Math.ceil(total_amounts * list[ i ].brokerage_fee / 100 );                           // PG수수료 = 중개수수료
            card_fee = Math.ceil(total_amounts * 3 / 100 );                                                      // 디폴트로 3% 판매수수료

            discounts = purchases['dataValues'].discount || 0;
            apply_points = purchases['dataValues'].apply_points || 0;

            /** 이미 종료상태에 있는 내역 **/
            for ( let k = 0 ; k < list[ i ].productHistories.length; k ++ ) {
                let purchases = await SalesHistories.findOne({
                    where: {
                        deleted: null,
                        old_product_id: Number( list[ i ].productHistories[k].id ),
                    },
                    attributes: [
                        [Sequelize.fn('count', Sequelize.col('id')), 'counts'],
                        [Sequelize.fn('sum', Sequelize.col('payment_amount')), 'total_payment_amounts'],
                        [Sequelize.fn('sum', Sequelize.col('discount')), 'discount'],
                        [Sequelize.fn('sum', Sequelize.col('apply_point')), 'apply_points'],
                    ],
                });

                purchaseCounts += Number( purchases['dataValues'].counts || 0 );
                total_payment_amounts += ( purchases['dataValues'].total_payment_amounts || 0 );
                let temp = ( purchases['dataValues'].total_payment_amounts || 0 ) + ( purchases['dataValues'].discount || 0 );
                total_amounts += temp;                                                                           // 총 판매금액
                brokerage_fee += Math.ceil(temp * list[ i ].productHistories[k].brokerage_fee / 100 );        // PG수수료 = 중개수수료
                card_fee += Math.ceil(temp * 3 / 100 );                                                       // 디폴트로 3% 판매수수료

                discounts = purchases['dataValues'].discount || 0;
                apply_points = purchases['dataValues'].apply_points || 0;
            }

            let array = [ 1, 2, 3 ];
            list[i]['dataValues'] = Object.assign( {}, list[i]['dataValues'], {
                purchaseCounts: purchaseCounts,
                total_payment_amounts: total_payment_amounts,                         // 결제금액
                brokerage_fee_amounts: brokerage_fee,                                 // PG수수료 = 중개수수료
                card_fee_amounts: card_fee,                                           // 판매수수료
                discounts: discounts,
                apply_points: array.includes( list[ i ].state ) ? null : Number( apply_points ),
            });
            delete list[i]['dataValues'].productHistories;
        }

        return res.status(200).json({ status: true, results: { list: list, total_pages: total_pages } } );
    } catch (e) {
        return res.status(200).json( { status: false, msg: [ e.toString() ] } );
    }
} );
/**
 * 판매현황
 */
router.all("/sales-detail", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 관리자에 의한 판매현황 상세얻기 ");
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분만이 이 요청을 하실수 있습니다']});
        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['공구를 선택하세요']});

        let total_counts = await SalesHistories.count({
            where: {
                deleted: null,
                product_id: Number( req.body.product_id ),
            },
        });
        const pagination  = req.body.pagination ? parseInt(req.body.pagination) : 10;
        const page_number = req.body.current_page ? parseInt(req.body.current_page) : 1;
        const total_pages = Math.ceil(total_counts / pagination);

        let list = await SalesHistories.findAll({
            where: {
                deleted: null,
                product_id: Number( req.body.product_id ),
            },
            include: [{
                as: "purchaseUser",
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: ['id', 'name', 'nickname', 'phone', 'address', 'address_detail'],
            }],
            offset: (page_number - 1) * pagination,
            limit: pagination,
            order: [['created', 'DESC']],
            attributes: ['id', 'created', 'buyer_phone', 'buyer_address', 'purchase_details', 'payment_amount', 'discount', 'payment_method', 'apply_point' ],
        });
        return res.status(200).json({ status: true, results: { list: list, total_pages: total_pages }});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
} );

/*****************************************************************************************************************************
 * * * * * * * * * * * * * * * * *                        판매정산                        * * * * * * * * * * * * * * * * * * *
 *****************************************************************************************************************************/
/**
 * 판매정산 리스트 얻기
 * start: 시작날짜
 * end: 마감날짜
 * state: 공구 상태, 1 -> 진행, 2 -> 종료
 * keyword_type: 1 -> 이름, 2 -> 닉네임, 3 -> 전화번호, 4 -> 주소
 * 전체인 경우엔 keywordType없이
 */
router.all( "/settlements-histories", async ( req, res ) => {
    try {
        console.log(req.body.jwt_data.id, " = 관리자를 위한 판매정산 리스트 " );
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분만이 이 요청을 하실수 있습니다']});

        Users.hasMany(Products);

        let settlements = await Users.findAll({
            where: {
                deleted: null,
                name: ( req.body.keyword_type === 1  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                nickname: ( req.body.keyword_type === 2  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                phone: ( req.body.keyword_type === 3  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                [Op.or]: (req.body.keyword_type === 4 && req.body.keyword ) ?
                    [ { address: {[Op.like]: "%" + req.body.keyword.toLowerCase() + "%"}, }, { address_detail: {[Op.like]: "%" + req.body.keyword.toLowerCase() + "%"}, } ]
                    :
                    [ { address: { [ Op.ne ]: null } } ],
            },
            include: [{
                model: Products,
                where: {
                    deleted: null,
                },
                include: [{
                    as: 'productHistories',
                    model: ProductHistories,
                    where: {
                        ended_state: 'end',
                        settlement_date:
                            req.body.start ?
                                req.body.end ?
                                    { [Op.gte]: new Date( req.body.start ).toUTCString(), [Op.lte]: new Date(req.body.end ).toUTCString(), }
                                    :
                                    { [Op.gte]: new Date( req.body.start ).toUTCString(), }
                                :
                                req.body.end ?
                                    { [Op.lte]: new Date(req.body.end ).toUTCString(), }
                                    :
                                    { [Op.ne]: null, },
                    },
                    order: [['settlement_date', "DESC"]],
                    attributes: ['id', 'product_id', 'settlement_date', 'brokerage_fee',]
                }],
                attributes: ['id'],
            }],
            attributes: ['id', 'name', 'nickname', 'phone', 'business_num', 'bank_account']
        });

        const pagination = req.body.pagination ? parseInt(req.body.pagination) : 10;
        const page_number = req.body.current_page ? parseInt(req.body.current_page) : 1;
        const total_pages = Math.ceil(settlements.length / pagination);

        settlements = settlements.splice((page_number - 1) * pagination,pagination);

        for ( let i = 0; i < settlements.length; i ++ ) {
            let histories = settlements[ i ].products;
            let total_amounts = 0;
            let brokerage_fee = 0;
            let card_fee = 0;
            let add_fee = 0;
            let last_settlemented = 0;
            for ( let j = 0; j < histories.length; j ++ ) {
                for ( let k = 0 ; k < histories[ j ].productHistories.length; k ++ ) {
                    let purchases = await SalesHistories.findOne({
                        where: {
                            deleted: null,
                            old_product_id: Number( histories[ j ].productHistories[k].id ),
                        },
                        attributes: [
                            [Sequelize.fn('sum', Sequelize.col('payment_amount')), 'total_payment_amounts'],
                            [Sequelize.fn('sum', Sequelize.col('discount')), 'discount'],
                            [Sequelize.fn('sum', Sequelize.col('apply_point')), 'apply_points'],
                        ],
                    });

                    let temp = purchases['dataValues'].total_payment_amounts + purchases['dataValues'].discount;
                    total_amounts += temp;       // 총 판매금액
                    brokerage_fee += Math.ceil(temp * histories[ j ].productHistories[k].brokerage_fee / 100 );  // PG수수료 = 중개수수료
                    card_fee += Math.ceil(temp * 3 / 100 );                                                      // 디폴트로 3% 판매수수료
                    add_fee += Math.ceil(( brokerage_fee + card_fee ) / 10 );                                             // 부가세
                    if ( last_settlemented === 0 || ( last_settlemented !== 0 && new Date( histories[ j ].productHistories[k].settlement_date ).getTime() > new Date( last_settlemented ).getTime() ) )
                        last_settlemented = histories[ j ].productHistories[ k ].settlement_date;
                }
            }
            settlements[i]['dataValues'] = Object.assign( {}, settlements[i]['dataValues'], {
                last_settlemented: last_settlemented,
                productCounts: histories.length,
                total_sale_amounts: total_amounts,                                    // 총 판매금액
                brokerage_fee_amounts: brokerage_fee,                                 // PG수수료 = 중개수수료
                card_fee_amounts: card_fee,                                           // 판매수수료
                add_fee: add_fee,                                                     // 부가세,
                settlements: total_amounts - brokerage_fee - card_fee - add_fee,      // 정산금액
            });
            delete settlements[i]['dataValues'].products;
        }

        return res.status(200).json({ status: true, results: { list: settlements, total_pages: total_pages } } );
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ] } );
    }
} );
/**
 * 판매정산 상세
 * product_id: Product테이블의 아이디
 */
router.all( "/settlements-detail", async ( req, res ) => {
    try {
        console.log(req.body.jwt_data.id, " = 관리자를 위한 판매정산 상세 " );
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분만이 이 요청을 하실수 있습니다']});

        if ( !req.body.user_id )
            return res.status(200).json({ status: false, msg: ['판매자를 선택하세요']});

        let products_list = await Products.findAll({
            where: {
                deleted: null,
                user_id: Number( req.body.user_id ),
            },
            include: [{
                as: 'productHistories',
                model: ProductHistories,
                where: {
                    ended_state: 'end',
                    settlement_date:
                        req.body.start ?
                            req.body.end ?
                                { [Op.gte]: new Date( req.body.start ).toUTCString(), [Op.lte]: new Date(req.body.end ).toUTCString(), }
                                :
                                { [Op.gte]: new Date( req.body.start ).toUTCString(), }
                            :
                            req.body.end ?
                                { [Op.lte]: new Date(req.body.end ).toUTCString(), }
                                :
                                { [Op.ne]: null, },
                },
                order: [['settlement_date', "DESC"]],
                attributes: ['id', 'product_id', 'created', 'finish_date', 'name', 'details', 'settlement_date', 'brokerage_fee',]
            }],
            attributes: [ 'id', ],
        });

        const pagination = req.body.pagination ? parseInt(req.body.pagination) : 10;
        const page_number = req.body.current_page ? parseInt(req.body.current_page) : 1;
        const total_pages = Math.ceil(products_list.length / pagination);

        products_list = products_list.splice((page_number - 1) * pagination,pagination);

        for ( let i = 0; i < products_list.length; i ++ ) {
            for ( let k = 0 ; k < products_list[ i ].productHistories.length; k ++ ) {
                let total_amounts = 0;
                let brokerage_fee = 0;
                let card_fee = 0;
                let add_fee = 0;
                let purchases = await SalesHistories.findOne({
                    where: {
                        deleted: null,
                        old_product_id: Number( products_list[ i ].productHistories[k].id ),
                    },
                    attributes: [
                        [Sequelize.fn('count', Sequelize.col('id')), 'counts'],
                        [Sequelize.fn('sum', Sequelize.col('payment_amount')), 'total_payment_amounts'],
                        [Sequelize.fn('sum', Sequelize.col('discount')), 'discount'],
                        [Sequelize.fn('sum', Sequelize.col('apply_point')), 'apply_points'],
                    ],
                });

                total_amounts = purchases['dataValues'].total_payment_amounts + purchases['dataValues'].discount;       // 총 판매금액
                brokerage_fee = Math.ceil(total_amounts * products_list[ i ].productHistories[k].brokerage_fee / 100 );  // PG수수료 = 중개수수료
                card_fee = Math.ceil(total_amounts * 3 / 100 );                                                      // 디폴트로 3% 판매수수료
                add_fee = Math.ceil(( brokerage_fee + card_fee ) / 10 );                                             // 부가세

                products_list[ i ].productHistories[k]['dataValues'] = Object.assign( {}, products_list[ i ].productHistories[k]['dataValues'], {
                    sales_counts: purchases['dataValues'].counts,                         // 구매건수
                    total_payment_amounts: purchases['dataValues'].total_payment_amounts, // 결제금액
                    discount: purchases['dataValues'].discount,                           // p할인금액
                    apply_points: purchases['dataValues'].apply_points,                   // p적립금
                    brokerage_fee_amounts: brokerage_fee,                                 // PG수수료 = 중개수수료
                    card_fee_amounts: card_fee,                                           // 판매수수료
                    add_fee: add_fee,
                });
                // delete products_list[ i ].products;
            }
        }

        return res.status(200).json({ status: true, results: products_list, total_pages: total_pages } );
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ] } );
    }
} );

/*****************************************************************************************************************************
 * * * * * * * * * * * * * * * * *                        운영관리                        * * * * * * * * * * * * * * * * * * *
 *****************************************************************************************************************************/
/**
 * 공구/컨텐츠 얻기
 * keyword_type: 1 -> 이름, 2 -> 닉네임, 3 -> 전화번호, 4 -> 상품명, 5 -> 컨텐츠
 * 전체인 경우엔 keywordType없이
 */
router.all("/contents", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 관리자에 의한 공구/컨텐츠리스트 얻기 " );
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분만이 이 요청을 하실수 있습니다']});

        let products = await Products.findAll({
            where: {
                deleted: null,
                name: ( req.body.keyword_type === 4  && req.body.keyword ) ? {[Op.like]: "%" + req.body.keyword + "%"} : { [Op.or]: [{[Op.ne]: null }, null ] },
                details: ( req.body.keyword_type === 5  && req.body.keyword ) ? {[Op.like]: "%" + req.body.keyword + "%"} : {[Op.ne]: null },
            },
            include: [{
                as: "saleUser",
                model: Users,
                where: {
                    deleted: null,
                    name: ( req.body.keyword_type === 1  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                    nickname: ( req.body.keyword_type === 2  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                    phone: ( req.body.keyword_type === 3  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                },
                required: true,
                attributes: ['id', 'name', 'nickname', 'phone'],
            }, {
                as: "togetherReports",
                model: Reports,
                include: [{
                    as: "reportedUser",
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: [ 'id', 'name', 'nickname', 'phone', ],
                }],
                required: false,
                attributes: ['id', 'user_id', 'product_id', 'created']
            }],
            order: [['created', 'DESC']],
            attributes: ['id', 'product_role', 'user_id', 'created', 'name', 'details', 'active_state' ],
        });

        /**
         * 댓글/답글 신고컨텐츠
         */
        let commits = await Commits.findAll({
            where: {
                deleted: null,
                contents: ( req.body.keyword_type === 5  && req.body.keyword ) ? {[Op.like]: "%" + req.body.keyword + "%"} : {[Op.ne]: null },
            },
            include: [{
                as: "users",
                model: Users,
                where: {
                    deleted: null,
                    name: ( req.body.keyword_type === 1  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                    nickname: ( req.body.keyword_type === 2  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                    phone: ( req.body.keyword_type === 3  && req.body.keyword ) ? req.body.keyword : {[Op.ne]: null },
                },
                attributes: [ 'id', 'name', 'nickname', 'phone', ],
            }, {
                as: "reportedCommits",
                model: Reports,
                include: [{
                    as: "reportedUser",
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: [ 'id', 'name', 'nickname', 'phone', ],
                }],
                required: false,
                attributes: ['id', 'user_id', 'commit_id', 'created']
            }],
            attributes: ['id', 'user_id', 'level', 'active_state', 'parent_id', 'product_id', 'contents', 'created' ]
        });

        const temp = {
            products: products,
            commits: commits,
        };

        return res.status(200).json({ status: true, results: temp });
    } catch (e) {
        return res.status(200).json( { status: false, msg: [ e.toString() ] } );
    }
} );
/**
 * 공구 노출상태 업뎃하기
 */
router.all("/update-product-state", async ( req, res ) => {
    try {
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['이 요청은 관리자분만이 하실수 있습니다']});
        if ( !req.body.product_ids )
            return res.status(200).json({status: false, msg: ['공구를 선택하세요']});
        for ( let k = 0; k < req.body.product_ids.length; k ++ ) {
            let product = await Products.findOne({
                where: {
                    id: Number( req.body.product_ids[ k ] ),
                    deleted: null,
                },
                attributes: ['id', 'active_state'],
            });
            if ( product )
                await Products.update({
                    active_state: !product.active_state,
                }, {
                    where: { id: Number( req.body.product_ids[ k ] ), }
                })
        }
        return res.status(200).json({ status: true, msg: ['선택된 공구의 노출상태가 성공적으로 업데이트되었습니다']});
    } catch (e) {
        return res.status(200).json({status: false, msg: [ e.toString() ]});
    }
});
/**
 * 댓글/답글 노출상태 업뎃하기
 */
router.all("/update-commit-state", async ( req, res ) => {
    try {
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['이 요청은 관리자분만이 하실수 있습니다']});

        if ( !req.body.commit_ids )
            return res.status(200).json({status: false, msg: ['댓글/답글을 선택하세요']});
        for ( let k = 0; k < req.body.commit_ids.length; k ++ ) {
            let commit = await Commits.findOne({
                where: {
                    id: Number( req.body.commit_ids[ k ] ),
                    deleted: null,
                },
                attributes: ['id', 'active_state'],
            });
            if ( commit )
                await Commits.update({
                    active_state: !commit.active_state,
                }, {
                    where: { id: Number( req.body.commit_ids[ k ] ), }
                })
        }
        return res.status(200).json({ status: true, msg: ['선택된 댓글/답글의 노출상태가 성공적으로 업데이트되었습니다']});
    } catch (e) {
        return res.status(200).json({status: false, msg: [ e.toString() ]});
    }
});
/**
 * 공구 전달상태 업뎃하기
 */
router.all("/deliver", async ( req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 공구 전달하기 " );
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: "관리자분만이 이 요청을 하실수 있습니다"});
        if ( !req.body.sales_id || !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});
        let payment = await SalesHistories.findOne({
            where: {
                id: Number( req.body.sales_id ),
                delivery_date: null,
                none_method: null,
                product_id: Number( req.body.product_id ),
            }
        });
        if ( !payment )
            return res.status(200).json({ status: false, msg: '요청하신 레코드는 존재하지 않습니다' } );
        if ( !payment.old_product_id )
            return res.status(200).json({ status: false, msg: ['종료된 공구에 대해서만 이 요청을 하실수 있습니다']});

        await SalesHistories.update({
            delivery_date: new Date(),
        }, {
            where: {
                id: Number(req.body.sales_id),
            }
        });
        return res.status(200).json({ status: true, msg: ['관리자분에 의하여 공구 전달상태가 성공적으로 업뎃되었습니다'] });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
});

module.exports = router;